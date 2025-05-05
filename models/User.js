const mongoose = require('mongoose'); //loads mongoose to define a schema

const userSchema = new mongoose.Schema({ //defines the fields a user must have
    name:{ //field validation to ensure no blank values
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true //checks for duplicate accounts
    },
    password: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('User', userSchema); //makes this model usable in other files