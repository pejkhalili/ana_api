const express = require('express');
const bodyParser = require("body-parser");
const session = require('express-session');
const ejs = require('ejs');
const mysql = require('mysql');
const app = express();
const md5 = require('md5');
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
    console.log("Local Connected.");
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set('view engine','ejs');
app.set('views', "./views/");


//Get Routes

app.get('/',(req,res)=>{
    let stat = req.session.login | false;
    return res.render("home",{status:stat});
});
app.get("/api/v1/:api/:event/:ver?/:cust?",(req,res)=>{
    let apiKey = req.params.api.toString();
    if(apiKey.length >=30){
        con.query(`Select id,events from APPS Where api_key = '${apiKey}'`,(err,appRes)=>{
            if(err) throw err
            let appId = appRes[0].id;
            let event = req.params.event;
            // let json =JSON.parse(req.params.json);
            let version = req.params.ver !== undefined ? req.params.ver : "any";
            let cust = req.params.cust!== undefined ? req.params.cust : "" ;
            let events = appRes[0].events.split("\r\n");
            let runable =false
            events.forEach(ev => {
                if(ev.toLowerCase() === event.toLowerCase()){
                    runable=true;
                }
            });
            if(runable){
                con.query(`INSERT INTO ANAT (event,app,version,cust) values('${event.toLowerCase()}','${appId}','${version}','${cust}')`,(err)=>{
                    if(err) throw err;
                    return res.send({'result':true ,'event':"\'" + event.toLowerCase() + "\'" });     
                });



            }else{
                return res.send({'result':false ,'error':'Undefined Event'});        
            }
            
        });

    }else{
        return res.send({'result':false ,'error':'Incorrect API KEY'});
    }

    

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
        if(result[0] !== undefined ) {
            const match = bcrypt.compareSync(pass, result[0].password);

            console.log(match.toString());
            if (match) {
                req.session.login = true;
                req.session.userId = result[0].id
                req.session.username = uname
                console.log(result);
                return res.redirect("/console");
            }
        }

        return res.render("login");


    });


});
app.get('/logout',(req,res)=>{
    req.session.login = false
    return res.redirect("/login");
})

app.get('/console', (req,res)=> {
    if (req.session.login) {
        let uname = req.session.username;
        let user_id =req.session.userId;
        con.query(`Select count(*) as appCount from APPS Where owner = '${user_id}' `,(err,appsRes)=>{
            if (err) throw  err;
            return res.render('index', {user: uname,apps: appsRes});
        });

    } else return res.render('login')
});
app.get('/console/apps', (req,res)=>{
    if(req.session.login){
        const userid = req.session.userId;
        const username = req.session.username;
        con.query(`SELECT id,name,packname From APPS Where owner = ${userid}`,(err,results)=>{
            if (err) throw err;
            return res.render('apps',{apps:results});
        })
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
        let u = {};
        u.owner = req.session.userId;
        u.name = req.body.appName;
        u.pack = req.body.packName;
        u.events = req.body.events;
        u.api = md5(u.owner+u.name+u.pack+u.events);

        con.query(`INSERT INTO APPS (owner,name,packname,api_key,events)
                    values ('${u.owner}','${u.name}','${u.pack}','${u.api}','${u.events}')`,
            (err)=>{
                if (err) throw err;
                return res.render('newApp',{app:u});
            });

    }
    else return res.render('login')
});

app.get('/console/apps/:id', (req,res)=>{
    let id = req.params.id;
    let user_id = req.session.userId;
    console.log("own" + user_id + " id" + id);
    con.query(`select * From APPS where id = '${id}' and owner='${user_id}'`,(err,getApp)=>{
        if(err) throw err;
        if (getApp !== undefined){
            con.query(`Select event,version, count(*) as anaCon from ANAT Where app='${id}' group by event,version `,(err,appStats)=>{
                if (err) throw err
                return res.render('app_details',{app:getApp,stat:appStats});
            });
        }
        console.log(getApp);
        // return res.render('app_details',{app:getApp,stat:undefined});
    });
});
app.get('/console/apps/:id/edit',(req,res)=>{
    if (req.session.login) {
        let id = req.params.id;
        con.query(`select id,name,packname,events,api_key from APPS where id = ${id}`,(err,edApp)=>{
            return res.render('editApp',{app:edApp});
        })


    }
    else return res.render('login');
});
app.get('/console/apps/:id/rm',(req,res)=>{
    if (req.session.login) {
        let id = req.params.id;
        con.query(`Delete from ANAT where app = ${id}`,(err)=>{
            if(err) throw err;
            con.query(`Delete from APPS where id = ${id}`,(err)=>{
                if(err) throw err;
                return res.redirect('/console/apps');
            });
        });
    }
    else return res.render('login');
});

app.get('/console/apps/:id/ana/:version/:event',(req,res)=>{
    if (req.session.login) {
        let version = req.params.version;
        let event = req.params.event;
        let appId = req.params.id;
        con.query(`select Date(time) as HRDate,Count(*) as anaCount from ANAT where 
                app='${appId}' and version = '${version}' and event = '${event}' group by Date(time) order by HRDate `,
            (err,moreDetails)=>{
                if(err) throw  err;
                return res.render('more_details',{app:moreDetails,appid:appId});
            });

    }
    else return res.render('login');


});

app.post('/console/apps/:id',(req,res)=>{
    let appId = req.params.id;
    let name = req.body.appName;
    let packname = req.body.packName;
    let events = req.body.events;
    con.query(`UPDATE APPS set name = '${name}' , packname='${packname}', events='${events}' where id = ${appId}`,(err)=>{
        if(err) {
            throw  err;
            return res.redirect("/console/apps");
        }else {
            return res.redirect("/console/apps/" + appId);
        }
    });
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


app.get("*",(req,res)=>{
    res.redirect("/");
})

const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
    console.log( `SERVER IS UP ON ${PORT}`);
});

//
// async function checkPass(hash,pass) {
//     return await  bcrypt.compare(pass,hash);
// }
