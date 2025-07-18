require("dotenv").config();

const jwt = require("jsonwebtoken");
const sanitizeHTML = require("sanitize-html");

//pull bcrypt package for hashing password
const bcrypt = require("bcrypt");

//cookie parser

const cookierParser = require("cookie-parser");

//pull express package

const express = require("express");
const db = require("better-sqlite3")("ourApp.db");

//improve speed of database

db.pragma("journal_mode = WAL");

//database setup here - we create the table structure for user name and password

const createTables = db.transaction(() => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username STRING NOT NULL UNIQUE,
    password STRING NOT NULL
    
    )
    `
  ).run();

  //post table

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS posts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createDate TEXT,
    title STRING NOT NULL,
    body TEXT NOT NULL,
    authorid INTEGER,
    FOREIGN KEY (authorid) REFERENCES users (id)
    )
    `
  ).run();
});
createTables();

//database table ends before this line

// This calls express and tells it to give us an empty server setup we can now configure

const app = express();

//tell express app to use the view engine called ejs

app.set("view engine", "ejs");

//enable feature to allows us access the values user type into the form

app.use(express.urlencoded({ extended: false }));

// make the public folder available for our application
app.use(express.static("public"));

app.use(cookierParser());

//Adding a middleware this comes after trying to display error in ejshomepage
app.use(function (req, res, next) {
  res.locals.error = [];
  // try to decode incoming cookie

  try {
    const decoded = jwt.verify(req.cookies.ourSimpleApp, process.env.JWTSECRET);
    req.user = decoded;
  } catch (err) {
    req.user = false;
  }

  res.locals.user = req.user;
  console.log(req.user);

  next();
});

//visit  a url

app.get("/", (req, res) => {
  //express gives us access to request and response
  if (req.user) {
    return res.render("dashboard");
  }
  res.render("homepage");
});

app.get("/api/cors-test", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

//setup a route for login page

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/logout", (req, res) => {
  res.clearCookie("ourSimpleApp");
  res.redirect("/");
});

app.post("/login", (req, res) => {
  let error = [];

  if (typeof req.body.username !== "string") req.body.username = "";
  if (typeof req.body.password !== "string") req.body.password = "";

  if (req.body.username.trim() == "") error = ["Invalid username/password."];
  if (req.body.password == "") error = ["Invalid username /password"];

  if (error.length) {
    return res.render("login", { error });
  }

  const userInQuestionStatement = db.prepare(
    "SELECT * FROM users WHERE USERNAME = ?"
  );
  const userInQuestion = userInQuestionStatement.get(req.body.username);

  if (!userInQuestion) {
    error = ["Invalid username /password."];
    return res.render("login", { error });
  }

  const matchOrNot = bcrypt.compareSync(
    req.body.password,
    userInQuestion.password
  );

  if (!matchOrNot) {
    error = ["Invalid username /password."];
    return res.render("login", { error });
  }

  // give users cookie and redirect

  const ourTokenValue = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      skyColor: "blue",
      userId: userInQuestion.id,
      username: userInQuestion.username,
    },
    process.env.JWTSECRET
  );
  res.cookie("ourSimpleApp", ourTokenValue, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 24, //cookie is good for one day
  });

  res.redirect("/");
});

function mustBeLoggedIn(req, res, next) {
  if (req.user) {
    return next();
  }
  return res.redirect("/");
}

app.get("/create-post", mustBeLoggedIn, (req, res) => {
  res.render("create-post");
});

function sharedPostValidation(req) {
  const error = [];

  if (typeof req.body.title !== "string") req.body.title = "";
  if (typeof req.body.body !== "string") req.body.body = "";

  req.body.title = sanitizeHTML(req.body.title.trim(), {
    allowedTags: [],
    allowedAttributes: {},
  });

  req.body.body = sanitizeHTML(req.body.body.trim(), {
    allowedTags: [],
    allowedAttributes: {},
  });

  if (!req.body.title) error.push("You must provide a title");
  if (!req.body.body) error.push("You must provide content");

  return error;
}

app.get("/edit-post/:id", mustBeLoggedIn, (req, res) => {
  // try to look up post in question

  const statement = db.prepare("SELECT * FROM posts WHERE id = ?");
  const post = statement.get(req.params.id);

  if (!post) {
    return res.redirect("/");
  }
  //if not author redirect to homepage
  if (post.authorid !== req.user.userId) {
    return res.redirect("/");
  }
  // otherwise, render edit post template

  res.render("edit-post", { post });
});

app.post("/edit-post/:id", mustBeLoggedIn, (req, res) => {
  const statement = db.prepare("SELECT * FROM posts WHERE id = ?");
  const post = statement.get(req.params.id);

  if (!post) {
    return res.redirect("/");
  }
  //if not author redirect to homepage
  if (post.authorid !== req.user.userId) {
    return res.redirect("/");
  }

  const error = sharedPostValidation(req);

  if (error.length) {
    return res.render("edit-post", { error });
  }

  const updateStatement = db.prepare(
    "UPDATE posts SET title =? ,  body= ? WHERE id=? "
  );
  updateStatement.run(req.body.title, req.body.body, req.params.id);
  res.redirect(`/post/${req.params.id}`);
});

app.post("/delete-post/:id", mustBeLoggedIn, (req, res) => {
  const statement = db.prepare("SELECT * FROM posts WHERE id = ?");
  const post = statement.get(req.params.id);

  if (!post) {
    return res.redirect("/");
  }
  //if not author redirect to homepage
  if (post.authorid !== req.user.userId) {
    return res.redirect("/");
  }

  const deleteStatemen = db.prepare("DELETE FROM posts WHERE id=?");
  deleteStatemen.run(req.params.id);
  res.redirect("/");
});

app.get("/post/:id", (req, res) => {
  const statement = db.prepare(
    "SELECT posts.*, users.username FROM posts INNER JOIN users ON posts.authorid = users.id WHERE posts.id =?"
  );
  const post = statement.get(req.params.id);

  if (!post) {
    return res.redirect("/");
  }

  res.render("single-post", { post: post });
});

app.post("/create-post", mustBeLoggedIn, (req, res) => {
  const error = sharedPostValidation(req);
  if (error.length) {
    return res.render("create-post", { error });
  }

  //save to database

  const ourStatement = db.prepare(
    "INSERT INTO posts (title,body,authorid,createDate ) VALUES (?,?,?,?)"
  );
  const result = ourStatement.run(
    req.body.title,
    req.body.body,
    req.user.userId,
    new Date().toISOString()
  );

  const getPostStatement = db.prepare("SELECT *FROM posts WHERE ROWID = ? ");
  const realPost = getPostStatement.get(result.lastInsertRowid);

  res.redirect(`/post/${realPost.id}`);
});

app.post("/register", (req, res) => {
  const error = [];

  if (typeof req.body.username !== "string") req.body.username = "";
  if (typeof req.body.password !== "string") req.body.password = "";

  req.body.username = req.body.username.trim();

  if (!req.body.username) error.push("You must provide a username");
  if (req.body.username && req.body.username.length < 4)
    error.push("Username should not be less than 6 characters");
  if (req.body.username && req.body.username.length > 10)
    error.push("Username should not exceed 10 characters");

  if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/))
    error.push("Username can only contain letters and numbers ");

  //chech if username exist already
  const usernameStatement = db.prepare(
    "SELECT * FROM users WHERE username = ?"
  );

  const usernameCheck = usernameStatement.get(req.body.username);

  if (usernameCheck) error.push("The username is already taken");

  if (!req.body.password) error.push("You must provide a password");
  if (req.body.password && req.body.password.length < 12)
    error.push("Password should be atleast 12 characters");
  if (req.body.password && req.body.password.length > 70)
    error.push("Username should not exceed 70 characters");

  if (error.length) {
    return res.render("homepage", { error });
  }
  // save the new user into a database
  //Hash password before saving into a database

  const salt = bcrypt.genSaltSync(10);
  req.body.password = bcrypt.hashSync(req.body.password, salt);

  const ourStatement = db.prepare(
    "INSERT INTO users (username,password) VALUES (?,?)"
  );

  const result = ourStatement.run(req.body.username, req.body.password);
  // Log user in by giving them a cookie

  const lookupStatement = db.prepare("SELECT * FROM users WHERE ROWID = ?");
  const ourUser = lookupStatement.get(result.lastInsertRowid);

  const ourTokenValue = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      skyColor: "blue",
      userId: ourUser.id,
      username: ourUser.username,
    },
    process.env.JWTSECRET
  );
  res.cookie("ourSimpleApp", ourTokenValue, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 24, //cookie is good for one day
  });

  res.redirect("/");
});
app.listen(3000);
