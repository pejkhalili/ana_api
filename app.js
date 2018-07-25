const express = require('express');
const bodyParser = require("body-parser");
const session = require('express-session');
const ejs = require('ejs');
const mysql = require('mysql');
const app = express();
const md5 = require('md5');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const PORT = process.env.PORT || 5000;

let con = mysql.createConnection({
    host:'localhost',
    user:'root',
    pass:'',
    database:'ana_api'
});

app.use(session({
    secret: 'ana_api',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}))
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.set('view engine','ejs');
app.set('views', "./views/");
con.connect((err)=>{
    if(err) throw err;
    console.log("Local Connected.");
});

app.get('/',
    (req,res)=>{
        let stat = req.session.login | false;
        return res.render("home",{status:stat});
    });
app.get("/api/v1/:api/:event/:ver?/:cust?",
    (req,res)=>{
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
app.get('/register',
    (req,res)=>{return res.render('sign_up') });
app.post('/register',
    (req,res)=>{
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
app.get('/login',
    (req,res)=>{

        if(req.session.login){
            return res.render('index')
        } else  return res.render('login')


    });
app.post("/login",
    (req,res)=> {
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
app.get('/logout',
    (req,res)=>{
        req.session.login = false
        return res.redirect("/login");
    })
app.get('/console',
    (req,res)=> {
        if (req.session.login) {
            let uname = req.session.username;
            let user_id =req.session.userId;
            con.query(`select Distinct owner from SHARE Where guest = ${user_id} and level <= 4`,(err,sharedOwners)=>{
                if (err)  console.log("FIRST>>>"+err)
                let owners = [];
                sharedOwners.forEach((sharedOwner)=>{
                    owners.push(sharedOwner.owner);
                });
                let appsCount=0;
                owners.forEach((owner)=>{
                    con.query(`select count(*) as AppCount from APPS where owner= '${owner}'`,(err,sharedApps)=>{
                        if (err)   console.log("IN LOOP>>>"+err)
                        if(sharedApps.length>0) appsCount += parseInt(sharedApps[0].AppCount)
                    });
                });
                con.query(`select Count(*) as AppCount from SHARE Where guest = ${user_id} and level >= 5`,(err,sharedApp)=>{
                    if (err)   console.log("IN LOOP>>>"+err)
                    if(sharedApp.length>0) appsCount += parseInt(sharedApp[0].AppCount)
                });

                con.query(`Select count(*) as appCount from APPS Where owner = '${user_id}'`,(err,appsRes)=>{
                    if (err)   console.log("THIRD>>>"+err)
                    console.log(">>>"+ appsCount);
                    res.render('index', {user: uname,apps: appsRes,shared:appsCount});
                });


            });

        }else return res.render('login')
    });
app.get('/console/apps',
    (req,res)=>{
        if(req.session.login){
            let uname = req.session.username;
            const userid = req.session.userId;
            const username = req.session.username;
            con.query(`SELECT id,name,packname From APPS Where owner = ${userid}`,(err,results)=>{
                if (err) throw err;
                return res.render('apps',{user:uname,apps:results});
            })
        }else{
            return res.render('login');
        }
    });
app.get('/console/apps/new',
    (req,res)=> {
        if (req.session.login) {
            let uname = req.session.username;
            return res.render('add_new_app',{user:uname});
        }else return res.render('login');
    });
app.post('/console/apps/new',
    (req,res)=>{
        if(req.session.login){
            let uname = req.session.username;
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
                    return res.render('newApp',{user:uname,app:u});
                });

        }
        else return res.render('login')
    });
app.get('/console/apps/:id',
    (req,res)=>{
        let id = req.params.id;
        let user_id = req.session.userId;
        let uname = req.session.username;
        console.log("own" + user_id + " id" + id);
        con.query(`select * From APPS where id = '${id}' and owner='${user_id}'`,(err,getApp)=>{
            if(err) throw err;
            if (getApp !== undefined){
                con.query(`Select event,version, count(*) as anaCon from ANAT Where app='${id}' group by event `,(err,appStats)=>{
                    if (err) throw err
                    return res.render('app_details',{user:uname,app:getApp,stat:appStats});
                });
            }
            console.log(getApp);
            // return res.render('app_details',{app:getApp,stat:undefined});
        });
    });
app.get('/console/apps/:id/edit',
    (req,res)=>{
        if (req.session.login) {
            let id = req.params.id;
            let uname = req.session.username;
            con.query(`select id,name,packname,events,api_key from APPS where id = ${id}`,(err,edApp)=>{
                return res.render('editApp',{user:uname, app:edApp});
            })


        }
        else return res.render('login');
    });
app.get('/console/apps/:id/rm',
    (req,res)=>{
        if (req.session.login) {
            let id = req.params.id;
            let uname = req.session.username;
            con.query(`Delete from ANAT where app = ${id}`,(err)=>{
                if(err) throw err;
                con.query(`Delete from APPS where id = ${id}`,(err)=>{
                    if(err) throw err;
                    return res.redirect('/console/apps',{user:uname});
                });
            });
        }
        else return res.render('login');
    });

app.get('/console/sharedApps',
    (req,res)=>{
        if(req.session.login){
            let uname = req.session.username;
            const userid = req.session.userId;
            const username = req.session.username;

            let owners = [];
            let appData = [];
            con.query(`select * From SHARE where guest = '${userid}' `,(err,sharedLinks)=>{
                if(err) throw  console.log("err>>>"+err);

                sharedLinks.forEach((link)=>{
                    owners.push(link);
                });


                owners.forEach((own)=>{
                    if(parseInt(own.level) < 5){
                        con.query(`select USERS.id as uid,USERS.username as username,APPS.id as id,name,packname 
                        From APPS left join USERS ON APPS.owner = USERS.id where APPS.owner = '${own.owner}' `,(err,linkProf)=>{
                            if(err) throw console.log("in Prof Loop "+err);
                            linkProf.forEach((lP)=>{ appData.push(lP)});
                            console.log("LP>>>>"+ JSON.stringify(linkProf));
                        });
                    }else if( parseInt(own.level) >= 5){
                        con.query(`select id,name,packname From APPS Where id = '${own.app_id}'`,(err,appLink)=>{
                            if(err) throw console.log("in App Loop "+err);
                            console.log("AP>>>>"+ JSON.stringify(appLink));
                            appData.push(appLink[0]);
                        });
                    }
                });

                con.query(`SELECT id From APPS limit 0`,(err,results)=>{
                    if (err) throw err;

                    return res.render('sharedApps',{user:uname,apps:appData});
                });

            });
        }else{
            return res.render('login');
        }
    });
app.get('/console/sharedApps/new',
    (req,res)=> {
        if (req.session.login) {
            let uname = req.session.username;
            return res.render('add_new_app',{user:uname});
        }else return res.render('login');
    });
app.post('/console/sharedApps/new',
    (req,res)=>{
        if(req.session.login){
            let uname = req.session.username;
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
                    return res.render('newApp',{user:uname,app:u});
                });

        }
        else return res.render('login')
    });
app.get('/console/sharedApps/:username/:id',
    (req,res)=>{
        let id = req.params.id;
        let user_id = req.session.userId;
        let uname = req.session.username;
        console.log("own" + user_id + " id" + id);
        con.query(`select * From APPS where id = '${id}' and owner='${user_id}'`,(err,getApp)=>{
            if(err) throw err;
            if (getApp !== undefined){
                con.query(`Select event,version, count(*) as anaCon from ANAT Where app='${id}' group by event `,(err,appStats)=>{
                    if (err) throw err
                    return res.render('app_details',{user:uname,app:getApp,stat:appStats});
                });
            }
            console.log(getApp);
            // return res.render('app_details',{app:getApp,stat:undefined});
        });
    });
app.get('/console/sharedApps/:id/edit',
    (req,res)=>{
        if (req.session.login) {
            let id = req.params.id;
            let uname = req.session.username;
            con.query(`select id,name,packname,events,api_key from APPS where id = ${id}`,(err,edApp)=>{
                return res.render('editApp',{user:uname, app:edApp});
            })


        }
        else return res.render('login');
    });
app.get('/console/sharedApps/:id/rm',
    (req,res)=>{
        if (req.session.login) {
            let id = req.params.id;
            let uname = req.session.username;
            con.query(`Delete from ANAT where app = ${id}`,(err)=>{
                if(err) throw err;
                con.query(`Delete from APPS where id = ${id}`,(err)=>{
                    if(err) throw err;
                    return res.redirect('/console/apps',{user:uname});
                });
            });
        }
        else return res.render('login');
    });





app.get('/console/apps/:id/ana/:version/:event',
    (req,res)=>{
        if (req.session.login) {
            let uname = req.session.username;
            let version = req.params.version;
            let event = req.params.event;
            let appId = req.params.id;
            con.query(`select Date(time) as HRDate,Count(*) as anaCount from ANAT where 
                app='${appId}' and version = '${version}' and event = '${event}' group by Date(time) order by HRDate `,
                (err,moreDetails)=>{
                    if(err) throw  err;
                    return res.render('more_details',{user:uname, app:moreDetails,appid:appId});
                });

        }
        else return res.render('login');


    });
app.get('/console/apps/:id/ana/:event',
    (req,res)=>{
        if (req.session.login) {
            let uname = req.session.username;
            let event = req.params.event;
            let appId = req.params.id;
            con.query(`select version,Date(time) as HRDate,Count(*) as anaCount from ANAT where 
                app='${appId}' and event = '${event}' group by Date(time),version order by HRDate DESC `,
                (err,moreDetails)=>{
                    if(err) throw  err;
                    return res.render('more_details',{user:uname, app:moreDetails,appid:appId});
                });

        }
        else return res.render('login');


    });
app.post('/console/apps/:id',
    (req,res)=>{

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
app.get('/console/user',
    (req,res)=>{
        if(req.session.login){
            let uname = req.session.username;
            return res.render('user',{user:uname});
        }else res.redirect("/login");
    });

app.get("*",(req,res)=>{
    res.redirect("/");
})



app.listen(PORT,()=>{
    console.log( `SERVER IS UP ON ${PORT}`);
});
