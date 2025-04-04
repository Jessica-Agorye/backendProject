//pulle xpress package

const express = require("express");

const app = express();

//tell express app to use the view engine called ejs

app.set("view engine", "ejs");

// make the public folder available for our application
app.use(express.static("public"));

//visit  a url

app.get("/", (req, res) => {
  //express gives us access to request and response
  res.render("homepage");
});

app.listen(3001);
