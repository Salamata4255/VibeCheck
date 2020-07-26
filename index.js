/*
Name: index.js
Purpose: Main backend script for the server written in node js
Version: 6/7/2020 1.50 pm
Authors: Deniz Cakiroglu
Dependencies: listed below under imported modules
*/
//import required modules
const mysql = require('mysql');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');     
const ejs = require('ejs');

const database = mysql.createConnection({//connect to the database
	host     : 'localhost',
	user     : 'root',
	password : 'admin',//change this to your password
	database : 'vibecheck'
});

const app = express();

app.set('view engine', 'ejs');

app.use(session({
	secret: 'secret',//make this safer by randomizing?
	resave: true,
	saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended : false}));//for getting info from html body
app.use(bodyParser.json());
app.use(express.static("public"));//sends css and image files to client which are all stored in a folder called public

const server = app.listen(3000);//connects to port 3000(regular http would be 80

app.get('/', function(req, res) {//sends the homepage
	res.sendFile(path.join(__dirname + '/home_test.html'));
});

app.get('/register', function(req, res) {//sends the register page if the user is not logged in
	if (req.session.loggedin){
		res.send('Logout to view this page!');
		res.end();
	}else{
		res.sendFile(path.join(__dirname + '/register.html'));
	}
});

app.get('/profile', function(req, res){//sends the profile page if the user is logged in
	if(req.session.loggedin){
		function send_profile(username, favorites){//the function for rendering profile.ejs
			let data = {username: username, favorites: favorites};//the variable values being assigned to the same variable names, this will be sent to the profile.ejs
			res.render(path.join(__dirname + "/profile.ejs"), data);
		}
		database.query('SELECT favorites FROM accounts WHERE username = ?', req.session.username, function(error,results){
			if(results[0].favorites == null){
				send_profile(req.session.username, []);
			}else{
				let favorites = results[0].favorites.split(',');
				send_profile(req.session.username, favorites);
			}
		});
	}else{
		res.send("You have to login first!");
		res.end();
	}
});

app.get('/logout', function(req, res){//logs out the user
	if (req.session.loggedin){
		req.session.username = '';
		req.session.loggedin = false;
		res.send('Successfully logged out!');
		res.end();
	}else{
		res.send('You are not logged in!');
		res.end();
	}
});

app.get('/login.html', function(req,res){//sends the login page if the user is not logged in
	if(req.session.loggedin){
		res.send("Logout to view this page!");
	}else{
		res.sendFile(path.join(__dirname + "/login.html"));
	}
});

app.get('/:file', function(req, res){//sends the requested html file(restarants)
	res.sendFile(path.join(__dirname + `/${req.params.file}`));
});

app.post('/auth', async(req, res)=> {//an auth post is made at login.html after clicking submit
	let username_input = req.body.username;
	if (username_input) {//if username is entered continues to check password
		database.query('SELECT password FROM accounts WHERE username = ?', username_input, async(error, results)=> {//gets the password of the given username from database
			if (results.length != 0){
				let pass_check = await bcrypt.compare(req.body.password, results[0].password);//hashes the entered password for comparison with the actual password hash
				if (pass_check) {//if password correct, redirects to the profile page
					req.session.loggedin = true;
					req.session.username = username_input;
					res.redirect('/profile');
				  } else {
					res.send("Wrong password!");
					res.end();
				  }
			}else{
				res.send("Wrong username!");
				res.end();
			}		
		});		
	} else {//missing credientials
		res.send('Please enter Username and Password!');
		res.end();
	}
});

app.post('/signup', async(req, res)=>{//a signup post is made from register page after submitting credientials
	try{
		let username_input = req.body.username;
		let salt = await bcrypt.genSalt();//salting the password hash for extra security
		let hashedpassword = await bcrypt.hash(req.body.password, salt);//hashing the password with the salt
		database.query('SELECT * FROM accounts WHERE username = ?', username_input, function(error, results){//matching usernames are requested for checking if the username is taken or not
			if (results.length != 0) {//username already used
				res.send('That username is taken, try again.');
				res.end();
			}else{//inserts the hashed password with the username to the database
				let sql = `INSERT INTO accounts(username,password) VALUES(?,?)`;
				let values = [username_input, hashedpassword];
				database.query(sql, values);
				username = '';
				res.redirect('/login.html');
			} 			
		});
	}catch{
		console.log("error");
		res.redirect('/register');
	}
});

app.post('/fav', function(req,res){//a fav post is made when favorite button for a restaurant is clicked
	if(req.session.loggedin){
		let sql = `update accounts set favorites = concat(ifnull(favorites,""), ?) where username = ?`;//sql line for appending restaurants
		let fav = `${req.body.favorite},`;//restaurants are seperated with a comma
		if(fav == undefined){//this isn't going to run, in case an unknown post request is made using /fav
			res.send("You can't favorite that!");
			res.end();
		}
		let username =  req.session.username;
		values = [fav, username];
		database.query('SELECT favorites FROM accounts WHERE username = ?', username, function(error, results){
			if(results[0].favorites == null){//if no restaurants exist for a given user it autmatically adds the restaurant
				database.query(sql,values,function(error){
					if (error){
						console.log("Error");
						res.end();
					}else{
						res.send(`${req.body.favorite} has been added to your favorites!`);
						res.end();
					}
				});
			}else{//in case there is already restaurants saved for the user
				let existing_restaurants = results[0].favorites.split(',');//the saved restaurants for the user are stored in an array
				if(existing_restaurants.indexOf(req.body.favorite) == -1){//checks if the restaurant already exists in the array(if it has already been added
					database.query(sql,values,function(error){
						if (error){
							console.log("Error");
							res.end();
						}else{
							res.send(`${req.body.favorite} has been added to your favorites!`);
							res.end();
						}
					});
				}else{//this runs if the restaurant is found in the array(has already been added prior)
					res.send("You have already added this restaurant to favorites!");
					res.end();
				}
			}	
		});	
	}else{
		res.send("Please log in to add to favorites!");
		res.end();
	}
});