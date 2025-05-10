//const API_URL = 'http://localhost:8000';

// Handle login form submission
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_CONFIG.API_URL}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                username: email,
                password: password
            })
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.access_token);
            window.location.href = '/index.html';
        } else {
            alert(data.detail || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed');
    }
});

// Handle signup form submission
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const userType = document.getElementById('userType').value;

    // Add this before the fetch call
    console.log('Sending signup data:', {
        email: email,
        password: password,
        user_type: userType
    });

    try {
        const response = await fetch(`${API_CONFIG.API_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password,
                user_type: userType
            })
        });

        const data = await response.json();

        // Add this after the fetch call
        console.log('Response status:', response.status);
        console.log('Response data:', data);

        if (!response.ok) {
            // Handle validation errors
            if (response.status === 422) {
                const errorMessage = data.detail;
                if (typeof errorMessage === 'object') {
                    // Handle multiple validation errors
                    const errors = Object.values(errorMessage).join('\n');
                    throw new Error(errors);
                } else {
                    throw new Error(errorMessage);
                }
            }
            throw new Error(data.detail || 'Signup failed');
        }

        alert('Sign up successful! Please login.');
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Signup error:', error);
        alert(error.message || 'Sign up failed');
    }
});

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}