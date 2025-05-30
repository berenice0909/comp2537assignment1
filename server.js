
  
  
require('dotenv').config(); //this loads the contents of my env file into the project and lets me safely use secrets without putting them directly in my code

const express = require('express'); //this imports the express library into a variable which is a framework that lets us build websites and APIs more easily 
const session = require('express-session'); //this module lets us store user data between page visits
const app = express(); //this app variable is now the web application, its like launching a web server from scratch using the tools Express gives u
const PORT = process.env.PORT || 3000; //this tells my app which port number to listen to, process.env.PORt is used in hosting platforms which assign a port number automatically ||3000 means if no port is assigned use 3000
const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI;
console.log("Loaded URI:", MONGODB_URI);
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt'); //this is a library that helps us hash passwords, making them secure
const User = require('./models/User'); //this is the Mongoose model we created in the env file that connects to the users collection
const Joi = require('joi'); //this helps us make sure the form input is correct 
app.set('view engine', 'ejs'); //this tells Express to use the EJS template engine which lets me write HTML pages that can include JS logic


///MIDDLEWARE////
app.use(express.urlencoded({ extended: true})); //this tell express how to read form data from <form> elements, urlencoded means the data is coming from the web, extended: true allows it to handle complex nested objects
app.use(express.static('public')); //tells Express to serve any files inside the public/ folder as is(css files, images, js files), i dont have to write special routes to load them now

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 60 * 60, // 1 hour in seconds
    })
}));


mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB succesfully'))
.catch((err) => console.error('MongoDB connection error:', err.message));

///ROUTE to HOME PAGE///
app.get('/', (req, res) => {
    res.render('home', { user: req.session.user });
  });  

////ROUTE to Sign Up////
app.get('/signup', (req, res) => { //this says when someone goes to this path localhost/3000/signup, run this code there is no req object used in this function, the res object sends back a result
    res.render('signup', { user: req.session.user }); //tells Express to render the file named signup.ejs, looks in views folder where engine is set up which produces HTML and sends it back to the browser
});

app.get('/login', (req, res) => {
  res.render('login', {
    user: req.session.user,
    error: null
  });
});



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.send('Error logging out.');
      }
      res.redirect('/login');
    });
  });

  function isLoggedIn(req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login'); // or send a message
    }
    next();
  }
  app.get('/protected', isLoggedIn, (req, res) => {
    res.send('This is a protected page.');
  });

app.get('/members', isLoggedIn, (req, res) => {
  res.render('members', { user: req.session.user });
});


function isAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.user_type !== 'admin') {
    return res.status(403).render('403', { user: req.session.user });
  }

  next();
}


app.get('/admin', isAdmin, async (req, res) => {
  try {
    const users = await User.find(); // gets all users from MongoDB
    res.render('admin', { user: req.session.user, users });
  } catch (err) {
    res.status(500).send('Server error retrieving users.');
  }
});

////POST ROUTE for SIGNUP////
app.post('/signup', async (req, res) => {
    const schema = Joi.object({
        name: Joi.string().trim().required(),
        email: Joi.string().email().trim(),
        password: Joi.string().min(5).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.send(`Validation error: ${error.details[0].message}`);
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        user_type: 'user' // ✅ Correctly added here
    });

    await user.save();
    req.session.user = user;
    res.redirect('/members');
});


////POST ROUTE for LOGIN////
app.post('/login', async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().trim().required(),
    password: Joi.string().min(5).required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.render('login', {
      user: null,
      error: `Validation error: ${error.details[0].message}`
    });
  }

  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return res.render('login', {
      user: null,
      error: 'Invalid email or password.'
    });
  }

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword) {
    return res.render('login', {
      user: null,
      error: 'Invalid email or password.'
    });
  }

  req.session.user = user;
  res.redirect('/members');
});


///ROUTE for ADMIN////
app.get('/promote/:id', isAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { user_type: 'admin' });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Failed to promote user.');
  }
});

app.get('/demote/:id', isAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { user_type: 'user' });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Failed to demote user.');
  }
});


app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


