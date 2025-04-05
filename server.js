//pulle xpress package

const express = require("express");

const app = express();

//tell express app to use the view engine called ejs

app.set("view engine", "ejs");

//enable feature to allows us access the values user type into the form

app.use(express.urlencoded({ extended: false }));

// make the public folder available for our application
app.use(express.static("public"));

//visit  a url

app.get("/", (req, res) => {
  //express gives us access to request and response
  res.render("homepage");
});

//setup a route for login page

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/register", (req, res) => {
  console.log(req.body);
  res.send("Thanks for registering");
});
app.listen(3001);
