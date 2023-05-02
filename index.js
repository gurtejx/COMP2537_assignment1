require("./utils");
require('dotenv').config();

// import some modules
const express = require('express'); 
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const Joi = require('joi');

// number of times password hashing will occur
const saltRounds = 12;

// create an instance of express module 
const app = express();

// setup port
const port = process.env.PORT || 3020;

// expires after 1 hr (mins * seconds * millis)
const expireTime = 60 * 60 * 1000;

// secret information section
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongo_password = process.env.MONGODB_PASSWORD;
const monogdb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

// destructing databaseConnection object to extract 'database' property
var {database} = include('databaseConnection');
const userCollection = database.db(monogdb_database).collection('users');
const sessionCollection = database.db(monogdb_database).collection('sessions');

// middleware function that parses incoming requests with URL payloads
app.use(express.urlencoded({extended: false}));

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongo_password}@${mongodb_host}/assignment1_db`,
    crypto: {secret: mongodb_session_secret}
});

// set up session management
app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false, 
    resave: true
}
));

// route for '/'
app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        var html = `
        <button><a href="/signup">Sign Up</a></button>
        <br><br>
        <button><a href="/login">Log In</a></button>
        `;
    }
    else {
        var name = req.session.name;
        var html = `
        <h1>Hello, ${name}</h1>
        <button><a href="/members">Go to Members Area</a></button>
        <br>
        <button><a href="/logout">Logout</a></button> 
        `;
    }
    res.send(html);
});

// route for sign up page
app.get('/signup', (req, res) => {
    var html = `
    <h4>create user</h4>
    <form action='/signupSubmit' method='post'>
    <input type="text" name="name" placeholder="name"> <br>
    <input type="text" name="email" placeholder="email"> <br>
    <input type="password" name="password" placeholder="password"> <br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

// route for login page
app.get('/login', (req,res) => {
    var html = `
    <h4>log in</h4>
    <form action='/loginSubmit' method='post'>
    <input name='email' type='text' placeholder='email'> <br>
    <input name='password' type='password' placeholder='password'> <br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

// route for validating new user inputs
app.post('/signupSubmit', async (req, res) => {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;

    if (name == "" || email == "" || password == "") {
        var html = `
        <h4>Name/email/password cannot be empty.</h4>
        <br>
        <a href='/signup'>Try again</a>
        `;
        res.send(html);
        return;
    }

    // validate the inout using Joi
    const schema = Joi.object({
        // name: Joi.string().regex(/^[a-zA-Z ]+$/).max(20).required(),
        name: Joi.string().alphanum().max(20).required(),
        email: Joi.string().email().max(50).required(),
        password: Joi.string().max(20).required()
    });

    const validationResult = schema.validate({name, email, password});
    if (validationResult.error != null) {
        console.log(validationResult.error);
        var html = `
        <h4>${validationResult.error}</h4>
        <br>
        <a href='/signup'>Try again</a>
        `;
        res.send(html);
        return;
    }

    // HASH the password
    var hashedPassword = await bcrypt.hashSync(password, saltRounds);
    await userCollection.insertOne({name: name, email: email, password: hashedPassword});
    console.log("Inserted user");

    // Create session and redirect user to /members page
    req.session.authenticated = true;
    req.session.email = email;
    req.session.name = name;
    req.session.cookie.maxAge = expireTime;
    res.redirect('/members');

});

// route for loginSubmit
app.post('/loginSubmit', async (req, res) => {
    var email = req.body.email;
    var password = req.body.password;

    if (email == "" || password == "") {
        var html = `
        <h4>Email/password cannot be empty.</h4>
        <br>
        <a href='/login'>Try again</a>
        `;
        res.send(html);
        return;
    }

    const schema = Joi.object({
        email: Joi.string().email().max(50).required(),
        password: Joi.string().max(20).required()
    });

    const validationResult = schema.validate({email, password});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/login");
	   return;
	}

    const result = await userCollection.find({email: email}).project({name: 1, email: 1, password: 1}).toArray();
    console.log(result);

    if (result.length != 1) {
        console.log("user not found");
        res.redirect('/login');
        return;
    }

    // check is password matches, if yes, log in and create a session
    if (await bcrypt.compare(password, result[0].password)) {
        console.log("correct password!");
        req.session.authenticated = true;
        req.session.name = result[0].name;
        req.session.email = email;
        req.session.cookie.maxAge = expireTime;

        res.redirect('/members');
        return;
    }
    else {
        console.log("incorrect password!");
        var html = `
        <h4>email/password combination incorrect.</h4>
        <br>
        <a href = '/login'>Try again</a>
        `;
        res.send(html);
        return;
    }
});

// route for members page
app.get('/members', (req, res) => {
    if (!req.session.authenticated) {
        res.redirect('/');
    }
    else {
        var name = req.session.name;
        var imgSwitch = Math.floor(Math.random() * 3) + 1;
        var imgSrc;

        switch(imgSwitch) {
            case 1: imgSrc = "obama.png";
            break;

            case 2: imgSrc = "biden.png";
            break;

            case 3: imgSrc = "trump.png";
            break;
        }

        var html = `
        <h1>Hello, ${name}</h1>
        <br>
        <div><img src='/${imgSrc}' style='width:250px;'></div>
        <br>
        <button><a href="/logout">Logout</a></button>
        `;
        res.send(html);
    }
});

app.use(express.static(__dirname + "/public"));

// route for logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// route for '/nosql-injection'
app.get('/nosql-injection', async (req, res) => {
    var username = req.query.user;
    if(!username) {
        res.send(`<h3>no user provided = try /nosql-injection?user=name</h3> <h3> or /nosql-injection?user[$ne]=name</h3>`);
        return;
    }
    console.log("user: " + username);

// set up schema to validate url
const schema = Joi.string().max(20).required();
const validationResult = schema.validate(username);

//If we didn't use Joi to validate and check for a valid URL parameter below
// we could run our userCollection.find and it would be possible to attack.
// A URL parameter of user[$ne]=name would get executed as a MongoDB command
// and may result in revealing information about all users or a successful
// login without knowing the correct password.
if (validationResult.error != null) {
    console.log(validationResult.error);
    res.send("<h1 style = 'color:darkred;'>A NoSQL injection attack was detected!</h1>");
    return;
}

const result = await userCollection.find({username: username}).project({username: 1, password: 1, _id: 1}).toArray();
console.log(result);

res.send(`<h1>Hello, ${result.username}</h1>`);
});


// handle 404 exception
app.get("*", (req, res) => {
    res.status(404);
    res.send("Page not found - 404");
});

app.listen(port, () => {
    console.log("Node application listening on port: " + port);
});