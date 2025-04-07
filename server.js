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
  const error = [];

  if (typeof req.body.username !== "string") req.body.username = "";
  if (typeof req.body.password !== "string") req.body.password = "";

  req.body.username = req.body.username.trim();

  if (!req.body.username) error.push("You must provide a username");
  if (req.body.password && req.body.username.length < 4)
    error.push("Username should not be less than 6 characters");
  if (req.body.password && req.body.username.length > 10)
    error.push("Username should not exceed 10 characters");

  if (req.body.username && !req.body.username.match(`^[a-zA-Z0-9{3,}]$`))
    error.push("Username can only contain letters and numbers ");
  res.send("Thanks for registering");
});
app.listen(3001);
