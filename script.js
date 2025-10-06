class WeatherAppPro {
    constructor() {
        this.map = null;
        this.currentMarker = null;
        this.activeLayer = 'standard';
        this.currentData = null;
        this.favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || ['Johannesburg', 'Gqeberha', 'Durban', 'Cape Town'];
        this.recognition = null;
        this.chart = null;
        this.currentTheme = localStorage.getItem('weatherTheme') || 'dark';
        
        this.apiKey = '2ca544c2d10b077fb32ed89ebef766cd'; 
        this.init();
    }

    init() {
        this.initializeMap();
        this.setupEventListeners();
        this.setupVoiceRecognition();
        this.setupThemeSwitcher();
        this.loadFavorites();
        this.applyTheme(this.currentTheme);
        this.getCurrentLocation();
    }

    initializeMap() {
        this.map = L.map('map').setView([-28.4793, 24.6727], 5);

        this.layers = {
            standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }),
            precipitation: L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${this.apiKey}`, {
                attribution: 'Precipitation © OpenWeatherMap',
                opacity: 0.6
            }),
            clouds: L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${this.apiKey}`, {
                attribution: 'Clouds © OpenWeatherMap',
                opacity: 0.6
            }),
            temperature: L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${this.apiKey}`, {
                attribution: 'Temperature © OpenWeatherMap',
                opacity: 0.6
            })
        };

        this.layers.standard.addTo(this.map);
    }

    setupEventListeners() {
        document.getElementById('search').addEventListener('click', () => this.searchWeather());
        document.getElementById('city').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });

        document.getElementById('current-location').addEventListener('click', () => this.getCurrentLocation());
        document.getElementById('share-weather').addEventListener('click', () => this.shareWeather());

        document.getElementById('zoom-in').addEventListener('click', () => this.map.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.map.zoomOut());

        document.getElementById('layer-standard').addEventListener('click', () => this.switchLayer('standard'));
        document.getElementById('layer-precipitation').addEventListener('click', () => this.switchLayer('precipitation'));
        document.getElementById('layer-clouds').addEventListener('click', () => this.switchLayer('clouds'));
        document.getElementById('layer-temperature').addEventListener('click', () => this.switchLayer('temperature'));

        document.getElementById('voice-search').addEventListener('click', () => this.startVoiceSearch());

        document.getElementById('add-favorite').addEventListener('click', () => this.addCurrentToFavorites());
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('favorite-btn')) {
                this.searchWeather(e.target.dataset.city);
            }
        });

        document.getElementById('close-alert').addEventListener('click', () => {
            document.getElementById('alert-section').classList.add('hidden');
        });
    }

    setupThemeSwitcher() {
        const themeButtons = document.querySelectorAll('.theme-btn');
        
        themeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.switchTheme(theme);
            });
        });
    }

    switchTheme(themeName) {
        this.currentTheme = themeName;
        
        document.documentElement.setAttribute('data-theme', themeName);
        
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');
        
        localStorage.setItem('weatherTheme', themeName);
        
        this.showSuccess(`Switched to ${this.getThemeName(themeName)} theme`);
    }

    applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const themeBtn = document.querySelector(`[data-theme="${themeName}"]`);
        if (themeBtn) {
            themeBtn.classList.add('active');
        }
    }

    getThemeName(themeKey) {
        const themeNames = {
            'dark': 'Dark',
            'light': 'Light', 
            'blue': 'Ocean Blue',
            'nature': 'Nature Green',
            'sunset': 'Sunset Orange',
            'purple': 'Purple Dream'
        };
        return themeNames[themeKey] || themeKey;
    }

    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            
            this.recognition.onstart = () => {
                document.getElementById('voice-search').classList.add('listening');
                this.showVoiceFeedback();
            };
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('city').value = transcript;
                this.hideVoiceFeedback();
                this.searchWeather();
            };
            
            this.recognition.onerror = () => {
                this.hideVoiceFeedback();
                this.showError('Voice recognition failed. Please try again.');
            };
            
            this.recognition.onend = () => {
                document.getElementById('voice-search').classList.remove('listening');
                this.hideVoiceFeedback();
            };
        }
    }

    startVoiceSearch() {
        if (this.recognition) {
            this.recognition.start();
        } else {
            this.showError('Voice recognition not supported in your browser');
        }
    }

    showVoiceFeedback() {
        document.getElementById('voice-feedback').classList.remove('hidden');
    }

    hideVoiceFeedback() {
        document.getElementById('voice-feedback').classList.add('hidden');
    }

    switchLayer(layerName) {
        document.querySelectorAll('.layer-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`layer-${layerName}`).classList.add('active');
        
        this.map.eachLayer(layer => {
            if (layer instanceof L.TileLayer && layer !== this.layers.standard) {
                this.map.removeLayer(layer);
            }
        });
        
        if (layerName !== 'standard') {
            this.layers[layerName].addTo(this.map);
        }
        
        this.activeLayer = layerName;
    }

    async searchWeather(city = null) {
        const searchCity = city || document.getElementById('city').value.trim();
        if (!searchCity) {
            this.showError('Please enter a city name');
            return;
        }

        this.showLoading();
        try {
            const normalizedCity = this.normalizeCityName(searchCity);
            const currentData = await this.fetchWeatherData(`q=${normalizedCity}`);
            const forecastData = await this.fetchForecastData(`q=${normalizedCity}`);
            const airQualityData = await this.fetchAirQuality(currentData.coord.lat, currentData.coord.lon);
            const historicalData = await this.generateHistoricalData(currentData);
            
            this.updateAllDisplays(currentData, forecastData, airQualityData, historicalData);
            this.showSuccess(`Weather data loaded for ${currentData.name}`);
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    normalizeCityName(cityName) {
        const cityMappings = {
            'Port Elizabeth': 'Gqeberha',
            'pe': 'Gqeberha',
            'gqeberha': 'Gqeberha',
            'joburg': 'Johannesburg',
            'jhb': 'Johannesburg',
            'jozie': 'Johannesburg',
            'ct': 'Cape Town',
            'durbs': 'Durban',
            'pta': 'Pretoria',
            'p-town': 'Pretoria',
            'bloem': 'Bloemfontein',
            'bfn': 'Bloemfontein',
            'pe': 'Gqeberha'
        };

        const lowerCity = cityName.toLowerCase().trim();
        return cityMappings[lowerCity] || cityName;
    }

    async fetchWeatherData(query) {
        let searchQuery = query;
        if (query.startsWith('q=') && !query.includes(',')) {
            searchQuery += ',ZA';
        }

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?${searchQuery}&appid=${this.apiKey}&units=metric`
        );
        
        if (!response.ok) {            if (searchQuery.includes(',ZA')) {
                const retryResponse = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${this.apiKey}&units=metric`
                );
                if (!retryResponse.ok) throw new Error('City not found');
                return await retryResponse.json();
            }
            throw new Error('City not found');
        }
        return await response.json();
    }

    async fetchForecastData(query) {        let searchQuery = query;
        if (query.startsWith('q=') && !query.includes(',')) {
            searchQuery += ',ZA';
        }

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?${searchQuery}&appid=${this.apiKey}&units=metric`
        );
        return await response.json();
    }

    async fetchAirQuality(lat, lon) {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${this.apiKey}`
            );
            const data = await response.json();
            return data.list[0];
        } catch (error) {
            console.error('Air quality data unavailable');
            return null;
        }
    }

    generateHistoricalData(currentData) {        const todayTemp = currentData.main.temp;
        return {
            labels: ['-4 days', '-3 days', '-2 days', '-1 day', 'Today'],
            temperatures: [
                todayTemp - 3 + Math.random() * 6,
                todayTemp - 2 + Math.random() * 4,
                todayTemp - 1 + Math.random() * 2,
                todayTemp - 0.5 + Math.random() * 1,
                todayTemp
            ]
        };
    }

    updateAllDisplays(currentData, forecastData, airQualityData, historicalData) {
        this.currentData = currentData;
        
        this.updateWeatherDisplay(currentData);
        this.updateAirQuality(airQualityData);
        this.updateForecast(forecastData);
        this.updateHistoricalChart(historicalData);
        this.updateMap(currentData);
        this.generateRecommendations(currentData);
        this.checkForAlerts(currentData);
    }

    updateWeatherDisplay(data) {        document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
        document.getElementById('weather-description').textContent = data.weather[0].description;
        document.getElementById('location').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${data.name}, ${data.sys.country}`;
                document.getElementById('feels-like').textContent = `${Math.round(data.main.feels_like)}°C`;
        document.getElementById('humidity').textContent = `${data.main.humidity}%`;
        document.getElementById('wind-speed').textContent = `${this.convertToKMH(data.wind.speed)} km/h`;
        document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
        const localTime = new Date(data.dt * 1000);
        document.getElementById('local-time').textContent = localTime.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);
        document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        document.getElementById('sunset').textContent = sunset.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        this.updateWeatherIcon(data.weather[0].main, data.weather[0].icon);
    }

    convertToKMH(mps) {
        return Math.round(mps * 3.6);
    }

    updateWeatherIcon(weatherMain, iconCode) {
        const iconElement = document.getElementById('weather-icon');
        let iconClass = 'fas fa-sun';
        let iconColor = '#f39c12';

        switch (weatherMain.toLowerCase()) {
            case 'clear':
                iconClass = iconCode.includes('d') ? 'fas fa-sun' : 'fas fa-moon';
                break;
            case 'clouds':
                iconClass = iconCode === '04d' || iconCode === '04n' ? 'fas fa-cloud' : 'fas fa-cloud-sun';
                break;
            case 'rain':
                iconClass = 'fas fa-cloud-rain';
                iconColor = '#3498db';
                break;
            case 'drizzle':
                iconClass = 'fas fa-cloud-drizzle';
                iconColor = '#3498db';
                break;
            case 'thunderstorm':
                iconClass = 'fas fa-bolt';
                iconColor = '#f1c40f';
                break;
            case 'snow':
                iconClass = 'fas fa-snowflake';
                iconColor = '#ecf0f1';
                break;
            case 'mist':
            case 'fog':
            case 'haze':
                iconClass = 'fas fa-smog';
                iconColor = '#bdc3c7';
                break;
            default:
                iconClass = 'fas fa-cloud-sun';
        }

        iconElement.innerHTML = `<i class="${iconClass}"></i>`;
        iconElement.style.color = iconColor;
    }

    updateAirQuality(data) {
        if (!data) {
            document.getElementById('aqi-value').textContent = 'N/A';
            document.getElementById('pm25').textContent = '-- μg/m³';
            document.getElementById('pm10').textContent = '-- μg/m³';
            document.getElementById('o3').textContent = '--';
            return;
        }

        const aqi = data.main.aqi;
        const components = data.components;

        const aqiElement = document.getElementById('aqi-value');
        aqiElement.textContent = this.getAQILevel(aqi).level;
        aqiElement.className = `aqi-badge ${this.getAQILevel(aqi).class}`;

        document.getElementById('pm25').textContent = `${components.pm2_5} μg/m³`;
        document.getElementById('pm10').textContent = `${components.pm10} μg/m³`;
        document.getElementById('o3').textContent = `${components.o3}`;
    }

    getAQILevel(aqi) {
        const levels = {
            1: { level: 'Excellent', class: 'excellent' },
            2: { level: 'Good', class: 'good' },
            3: { level: 'Moderate', class: 'moderate' },
            4: { level: 'Poor', class: 'poor' },
            5: { level: 'Very Poor', class: 'poor' }
        };
        return levels[aqi] || { level: 'Unknown', class: '' };
    }

    generateRecommendations(data) {
        const temp = data.main.temp;
        const weather = data.weather[0].main.toLowerCase();
        const wind = this.convertToKMH(data.wind.speed);
        const humidity = data.main.humidity;
        
        let recommendations = [];

        if (temp > 35) {
            recommendations.push(" Heatwave conditions! Stay hydrated and avoid direct sun");
        } else if (temp > 30) {
            recommendations.push("Very hot! Perfect for swimming or staying in air conditioning");
        } else if (temp > 25) {
            recommendations.push("Perfect braai weather! Great for outdoor activities");
        } else if (temp > 18) {
            recommendations.push("Pleasant weather. Light jacket recommended for evening");
        } else if (temp > 10) {
            recommendations.push("Cool weather. Wear warm clothing");
        } else {
            recommendations.push("Cold! Bundle up with warm layers");
        }

        if (weather.includes('rain')) {
            recommendations.push("Rain expected. Perfect day for indoor activities");
            
            if (humidity > 80) {
                recommendations.push("High humidity. Good for skin, bad for hair!");
            }
        } else if (weather.includes('cloud')) {
            recommendations.push("Cloudy skies. Good for hiking without sunburn risk");
        } else if (weather.includes('clear')) {
            recommendations.push("Sunny! Perfect for beach day - don't forget sunscreen");
            
            if (temp > 25) {
                recommendations.push("Great weather for a braai at the beach");
            }
        }

        if (wind > 40) {
            recommendations.push("Strong winds! Secure outdoor furniture and be careful driving");
        } else if (wind > 25) {
            recommendations.push("Breezy conditions. Good for flying kites");
        }

        if (temp > 28 && weather.includes('clear')) {
            recommendations.push("Stay hydrated! Drink plenty of water in this heat");
        }

        if (temp < 12) {
            recommendations.push("Perfect weather for enjoying hot drinks indoors");
        }

        document.getElementById('recommendations').innerHTML = recommendations
            .map(rec => `<div class="recommendation-item">• ${rec}</div>`)
            .join('');
    }

    checkForAlerts(data) {
        const alerts = [];
        const windKMH = this.convertToKMH(data.wind.speed);
        
        if (windKMH > 50) {
            alerts.push({
                event: "High Wind Warning",
                description: "Strong winds expected. Secure outdoor objects and avoid coastal areas."
            });
        }
        
        if (data.main.temp > 35) {
            alerts.push({
                event: "Heat Advisory", 
                description: "Extreme heat expected. Stay hydrated and avoid sun exposure during peak hours."
            });
        }

        if (data.weather[0].main === 'Thunderstorm') {
            alerts.push({
                event: "Thunderstorm Warning",
                description: "Thunderstorms in the area. Seek shelter if outdoors and avoid open fields."
            });
        }

        if (data.main.humidity > 85 && data.main.temp > 25) {
            alerts.push({
                event: "High Humidity Alert",
                description: "Very humid conditions. Stay cool and hydrated."
            });
        }

        this.showAlerts(alerts);
    }

    showAlerts(alerts) {
        const alertSection = document.getElementById('alert-section');
        const alertTitle = document.getElementById('alert-title');
        const alertContent = document.getElementById('alert-content');

        if (alerts.length > 0) {
            alertTitle.textContent = `${alerts.length} Weather Alert${alerts.length > 1 ? 's' : ''}`;
            alertContent.innerHTML = alerts.map(alert => `
                <div class="alert-item">
                    <strong>${alert.event}</strong><br>
                    ${alert.description}
                </div>
            `).join('<hr>');
            alertSection.classList.remove('hidden');
        } else {
            alertSection.classList.add('hidden');
        }
    }

    updateForecast(forecastData) {
        const forecastContainer = document.getElementById('forecast');
        forecastContainer.innerHTML = '';

        const dailyForecasts = [];
        const processedDays = new Set();

        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!processedDays.has(date) && dailyForecasts.length < 5) {
                processedDays.add(date);
                dailyForecasts.push(item);
            }
        });

        dailyForecasts.forEach(day => {
            const forecastDay = document.createElement('div');
            forecastDay.className = 'forecast-day';
            
            const date = new Date(day.dt * 1000);
            const dayName = date.toLocaleDateString('en-ZA', { weekday: 'short' });
            const dateStr = date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });

            forecastDay.innerHTML = `
                <div class="forecast-date">
                    <div>${dayName}</div>
                    <div>${dateStr}</div>
                </div>
                <div class="forecast-icon">
                    <i class="fas fa-sun"></i>
                </div>
                <div class="forecast-temp">${Math.round(day.main.temp)}°C</div>
                <div class="forecast-desc">${day.weather[0].description}</div>
                <div class="forecast-wind">${this.convertToKMH(day.wind.speed)} km/h</div>
            `;

            forecastContainer.appendChild(forecastDay);
        });
    }

    updateHistoricalChart(data) {
        const ctx = document.getElementById('historical-chart');
        ctx.innerHTML = '<canvas id="trendChart"></canvas>';
        
        if (this.chart) {
            this.chart.destroy();
        }

        const chartElement = document.getElementById('trendChart');
        if (!chartElement) return;

        this.chart = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Temperature (°C)',
                    data: data.temperatures,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Temperature: ${context.parsed.y}°C`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)',
                            callback: function(value) {
                                return value + '°C';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    }
                }
            }
        });
    }

    updateMap(weatherData) {
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }

        const lat = weatherData.coord.lat;
        const lon = weatherData.coord.lon;
        const temp = Math.round(weatherData.main.temp);
        const description = weatherData.weather[0].description;
        const windKMH = this.convertToKMH(weatherData.wind.speed);

        this.currentMarker = L.marker([lat, lon])
            .addTo(this.map)
            .bindPopup(`
                <div style="text-align: center;">
                    <strong>${weatherData.name}</strong><br>
                    ${temp}°C - ${description}<br>
                    Wind: ${windKMH} km/h<br>
                    Humidity: ${weatherData.main.humidity}%
                </div>
            `)
            .openPopup();

        this.map.setView([lat, lon], 10);
    }

    getCurrentLocation() {
        if (navigator.geolocation) {
            this.showLoading('Getting your location...');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    this.fetchWeatherByCoords(lat, lon);
                },
                (error) => {
                    this.showError('Unable to get your location. Please enable location services.');
                    console.error('Geolocation error:', error);
                    this.searchWeather('Johannesburg');
                }
            );
        } else {
            this.showError('Geolocation is not supported by your browser');
            this.searchWeather('Johannesburg');
        }
    }

    async fetchWeatherByCoords(lat, lon) {
        try {
            const currentData = await this.fetchWeatherData(`lat=${lat}&lon=${lon}`);
            const forecastData = await this.fetchForecastData(`lat=${lat}&lon=${lon}`);
            const airQualityData = await this.fetchAirQuality(lat, lon);
            const historicalData = await this.generateHistoricalData(currentData);
            
            this.updateAllDisplays(currentData, forecastData, airQualityData, historicalData);
            this.showSuccess(`Weather data loaded for your location`);
            
        } catch (error) {
            this.showError('Error fetching weather data for your location');
        }
    }

    loadFavorites() {
        const container = document.getElementById('favorites-list');
        const addBtn = container.querySelector('.favorite-add-btn');
        container.innerHTML = '';
        
        this.favorites.forEach(city => {
            const btn = document.createElement('button');
            btn.className = 'favorite-btn';
            btn.textContent = city;
            btn.dataset.city = city;
            container.appendChild(btn);
        });
        
        container.appendChild(addBtn);
    }

    addCurrentToFavorites() {
        if (!this.currentData) {
            this.showError('No current weather data to add to favorites');
            return;
        }

        const city = this.currentData.name;
        if (!this.favorites.includes(city)) {
            this.favorites.push(city);
            localStorage.setItem('weatherFavorites', JSON.stringify(this.favorites));
            this.loadFavorites();
            this.showSuccess(`${city} added to favorites!`);
        } else {
            this.showError(`${city} is already in favorites`);
        }
    }

    shareWeather() {
        if (!this.currentData) {
            this.showError('No weather data to share');
            return;
        }

        const shareData = {
            title: `Weather in ${this.currentData.name}`,
            text: `It's ${Math.round(this.currentData.main.temp)}°C and ${this.currentData.weather[0].description} in ${this.currentData.name}! Wind: ${this.convertToKMH(this.currentData.wind.speed)} km/h. Check out this awesome weather app!`,
            url: window.location.href
        };

        if (navigator.share) {
            navigator.share(shareData).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareData.text).then(() => {
                this.showSuccess('Weather info copied to clipboard!');
            }).catch(() => {
                this.showError('Sharing not supported on this device');
            });
        }
    }

    showLoading(message = 'Loading weather data...') {
        this.clearMessages();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'success-message loading';
        loadingDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        document.querySelector('.search-section').appendChild(loadingDiv);
    }

    showError(message) {
        this.clearMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
        document.querySelector('.search-section').appendChild(errorDiv);
    }

    showSuccess(message) {
        this.clearMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        document.querySelector('.search-section').appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    clearMessages() {
        const messages = document.querySelectorAll('.error-message, .success-message');
        messages.forEach(msg => msg.remove());
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    @keyframes voicePulse {
        0% { transform: scale(0.8); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
    }
    
    .voice-feedback {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 30px;
        border-radius: 20px;
        text-align: center;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
    }
    
    .voice-feedback i {
        font-size: 2rem;
        color: #e74c3c;
    }
    
    .voice-pulse {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(231, 76, 60, 0.3);
        animation: voicePulse 1.5s infinite;
    }
    
    .success-message {
        background: linear-gradient(135deg, #27ae60, #2ecc71);
        color: white;
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        margin: 10px 0;
        animation: slideIn 0.5s ease-out;
    }
    
    .error-message {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        color: white;
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        margin: 10px 0;
        animation: shake 0.5s ease-in-out;
    }
    
    .forecast-wind {
        font-size: 0.7rem;
        color: var(--text-muted);
        margin-top: 5px;
    }
    
    @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .loading {
        opacity: 0.7;
        pointer-events: none;
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new WeatherAppPro();
});
