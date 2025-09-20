// admin.js
// Handles admin login, FAQ creation and gallery image uploads.

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const adminContent = document.getElementById('admin-content');
  const loginForm = document.getElementById('login-form');
  const faqForm = document.getElementById('faq-form');
  const galleryForm = document.getElementById('gallery-form');
  const logoutBtn = document.getElementById('logout-btn');

  // Show the appropriate section based on existing token
  const existingToken = localStorage.getItem('adminToken');
  if (existingToken) {
    showAdmin();
  } else {
    showLogin();
  }

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        alert('Login failed');
        return;
      }
      const data = await res.json();
      if (data && data.token) {
        localStorage.setItem('adminToken', data.token);
        showAdmin();
      } else {
        alert('Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Login error');
    }
  });

  // Handle FAQ form submission
  faqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = document.getElementById('faq-question').value.trim();
    const answer = document.getElementById('faq-answer').value.trim();
    if (!question || !answer) return;
    const token = localStorage.getItem('adminToken');
    try {
      const res = await fetch('/api/admin/add-faq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question, answer })
      });
      if (!res.ok) {
        alert('Failed to add FAQ');
        return;
      }
      alert('FAQ added successfully');
      // Clear form
      document.getElementById('faq-question').value = '';
      document.getElementById('faq-answer').value = '';
    } catch (err) {
      console.error('Add FAQ error:', err);
      alert('Error adding FAQ');
    }
  });

  // Handle gallery form submission
  galleryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const beforeInput = document.getElementById('before-image');
    const afterInput = document.getElementById('after-image');
    const beforeFile = beforeInput.files[0];
    const afterFile = afterInput.files[0];
    if (!beforeFile || !afterFile) return;
    const token = localStorage.getItem('adminToken');
    // Convert files to base64 strings
    const toDataURL = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
    try {
      const [beforeBase64, afterBase64] = await Promise.all([toDataURL(beforeFile), toDataURL(afterFile)]);
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ before: beforeBase64, after: afterBase64 })
      });
      if (!res.ok) {
        alert('Failed to upload images');
        return;
      }
      alert('Images uploaded successfully');
      // Clear file inputs
      beforeInput.value = '';
      afterInput.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      alert('Error uploading images');
    }
  });

  // Logout functionality
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    showLogin();
  });

  function showLogin() {
    loginSection.classList.add('visible');
    adminContent.classList.remove('visible');
  }

  function showAdmin() {
    loginSection.classList.remove('visible');
    adminContent.classList.add('visible');
  }
});