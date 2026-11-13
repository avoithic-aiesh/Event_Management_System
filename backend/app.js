const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse incoming JSON payloads
app.use(express.json());

// Root route handler
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is happily running on http://localhost:${PORT}`);
});
