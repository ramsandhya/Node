var express = require('express');
var app = express();

// reading static files so use() function isused 
app.use(express.static(__dirname));
app.listen(5000);
