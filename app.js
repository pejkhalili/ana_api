const express = require('express');
const bodyParser = require("body-parser");
const session = require('express-session');
const ejs = require('ejs');
const mysql = require('mysql');
const app = express();

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.use(session({
    secret: 'ana_api',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))



let con = mysql.createConnection({
    host:'localhost',
    user:'root',
    pass:'',
    database:'ana_api'
});

con.connect((err)=>{
    if(err) throw err;
    console.log("You're Now Connected.");
});



app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname+"/public"));
app.set('view engine','ejs');
app.set('views', "./views/");


//Get Routes

app.get('/',(req,res)=>{
    res.redirect("/console")
});


app.get('/register', (req,res)=>{return res.render('sign_up') });

app.post('/register', (req,res)=>{
    if(req.body.password != req.body.repassword) return res.redirect("/register")
    let salt = bcrypt.genSaltSync(saltRounds);
    let hash = bcrypt.hashSync(req.body.password,salt);
    let user = {
        email:req.body.email,
        username:req.body.username,
        password:hash

    }

    con.query(
        `INSERT INTO USERS(email,username,password) value ('${user.email}','${user.username}','${user.password}')`,(err)=>{
            if (err) throw err

        });
    console.log(user)
    return res.redirect('/console');

});



app.get('/login', (req,res)=>{

    if(req.session.login){
        return res.render('index')
    } else  return res.render('login')


});

app.post("/login",(req,res)=> {
    const uname = req.body.username;
    const pass = req.body.password;

    con.query(`SELECT * FROM USERS Where email ='${uname}' or username = '${uname}' `, (err, result) => {
        if (err) throw err;

        const match = bcrypt.compareSync(pass, result[0].password);

        console.log(match.toString());
        if (match) {
            req.session.login = true;

            console.log(result);
            res.redirect("/console");
        } else {
            res.render("login");
        }
    });


});
app.get('/logout',(req,res)=>{
    req.session.login = false
    return res.redirect("/login");
})

app.get('/console', (req,res)=> {
    if (req.session.login) {
        let creds = {
            user: ""
        }
        return res.render('index', {creds: creds});
    } else return res.render('login')
})


app.get('/console/apps', (req,res)=>{
    if(req.session.login){
    return res.render('apps');
    }else{
        return res.render('login');
    }
});

app.get('/console/apps/new', (req,res)=> {
    if (req.session.login) return res.render('add_new_app');
    else return res.render('login');
});

app.post('/console/apps/new', (req,res)=>{
    if(req.session.login){
        console.log(req.body)

        return res.render('add_new_app');
    }
    else return res.render('login')
});

app.get('/console/apps/:id', (req,res)=>{
    let id = req.params.id
    console.log(id)
    return res.render('app_details',{id:id});
});

app.get('/console/events', (req,res)=>{
    return res.render('events');
});

app.get('/console/events/new', (req,res)=>{
    return res.render('add_new_event');
});
app.get('/console/appVersions', (req,res)=>{
    
});
app.get('/console/user', (req,res)=>{
    return res.render('user');
});


//Posts Routes




const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
    console.log( `SERVER IS UP ON ${PORT}`);
});

//
// async function checkPass(hash,pass) {
//     return await  bcrypt.compare(pass,hash);
// }
