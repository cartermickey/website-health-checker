const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/sites', require('./routes/sites'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/audit', require('./routes/stream'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health checker running at http://localhost:${PORT}`));

module.exports = app;
