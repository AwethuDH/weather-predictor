// Initialize the map
const map = L.map('map').setView([-30.5595, 22.9375], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

function fetchWeather(city) {
    const apiKey = '2ca544c2d10b077fb32ed89ebef766cd';
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city},ZA&appid=${apiKey}&units=metric`)
        .then(response => response.json())
        .then(data => {
            if (data.cod === 200) {
                const temperature = data.main.temp;
                const weatherDescription = data.weather[0].description;
                const time = new Date(data.dt * 1000).toLocaleTimeString();

                document.getElementById('weather-result').textContent = `Temperature in ${data.name}: ${temperature}°C, ${weatherDescription}`;
                document.getElementById('thermal-info').textContent = `Thermal info: ${temperature}°C`;
                document.getElementById('time-info').textContent = `Time: ${time}`;

               
                map.eachLayer(layer => {
                    if (layer instanceof L.Marker) {
                        map.removeLayer(layer);
                    }
                });

                const lat = data.coord.lat;
                const lon = data.coord.lon;
                L.marker([lat, lon]).addTo(map).bindPopup(`${data.name}: ${temperature}°C`).openPopup();
                map.setView([lat, lon], 10);
            } else {
                document.getElementById('weather-result').textContent = 'City not found. Please try again.';
            }
        })
        .catch(error => {
            document.getElementById('weather-result').textContent = 'Error fetching weather data. Please try again.';
            console.error(error);
        });
}


document.getElementById('search').addEventListener('click', function () {
    const city = document.getElementById('city').value;
    if (city) {
        fetchWeather(city);
    } else {
        document.getElementById('weather-result').textContent = 'Please enter a city name.';
    }
});

function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            map.setView([lat, lon], 10);
            L.marker([lat, lon]).addTo(map).bindPopup("You are here").openPopup();
            const apiKey = 'your_actual_api_key_here';
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
                .then(response => response.json())
                .then(data => {
                    const temperature = data.main.temp;
                    const weatherDescription = data.weather[0].description;
                    const time = new Date(data.dt * 1000).toLocaleTimeString();

                    document.getElementById('weather-result').textContent = `Current Location: ${temperature}°C, ${weatherDescription}`;
                    document.getElementById('thermal-info').textContent = `Thermal info: ${temperature}°C`;
                    document.getElementById('time-info').textContent = `Time: ${time}`;
                });
        }, () => {
            document.getElementById('weather-result').textContent = 'Geolocation not available or permission denied.';
        });
    } else {
        document.getElementById('weather-result').textContent = 'Geolocation is not supported by your browser.';
    }
}
window.onload = getCurrentLocation;
