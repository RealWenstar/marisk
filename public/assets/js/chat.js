// chat.js
// Simple chat widget to interface with FAQ suggestions and chat API.

document.addEventListener('DOMContentLoaded', () => {
  const chatToggle = document.getElementById('chat-toggle');
  const chatWindow = document.getElementById('chat-window');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const suggestionsList = document.getElementById('chat-suggestions-list');

  // Function to append a message to the chat window
  function addMessage(content, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.textContent = content;
    chatMessages.appendChild(div);
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Fetch random suggested questions from the server
  async function loadSuggestions() {
    try {
      const res = await fetch('/api/faqs-suggestions');
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      const data = await res.json();
      suggestionsList.innerHTML = '';
      data.forEach(q => {
        const li = document.createElement('li');
        li.textContent = q;
        li.addEventListener('click', () => {
          chatInput.value = q;
          sendMessage();
        });
        suggestionsList.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading suggestions:', err);
    }
  }

  // Send a question to the chat API and display the response
  async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question) return;
    addMessage(question, 'user');
    chatInput.value = '';
    try {
      const lang = localStorage.getItem('language') || 'en';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, lang })
      });
      const data = await res.json();
      const answer = data.answer || data.response || data.message || '...';
      addMessage(answer, 'bot');
    } catch (err) {
      console.error('Chat error:', err);
      addMessage('An error occurred. Please try again later.', 'bot');
    }
  }

  // Toggle chat window open/close
  chatToggle.addEventListener('click', () => {
    chatWindow.classList.toggle('open');
    chatToggle.classList.toggle('open');
    // When opening chat window, load fresh suggestions
    if (chatWindow.classList.contains('open')) {
      loadSuggestions();
    }
  });

  // Send message on button click or Enter key
  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });
});