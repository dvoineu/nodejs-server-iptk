/*
 RESTFul Services NodeJS
 */
const net = require('net');
 var crypto = require('crypto');
 var uuid = require('uuid');
 var express = require('express');
 var mysql = require('mysql');
 var bodyParser = require('body-parser');
const port 	   = process.env.PORT || 3000;


 //MYSQL Connection
 // var con=mysql.createPool({
 //
 //     host:'sql7.freesqldatabase.com',
 //     user:'sql7283688',
 //     password:'Tjel4cFcwB',
 //     database:'sql7283688'
 //
 //    });
var con = mysql.createConnection({
    host:'sql7.freesqldatabase.com',
    user:'sql7283688',
    password:'Tjel4cFcwB',
    database:'sql7283688'
});


con.connect(function(err) {
    if(err){
        throw err;
    }
});


function sql(sql, params, response) {
    con.query(sql,params ,function (err, result, fields) {
        if (err) throw err;
        response(result);
    });
}


const server = net.createServer((c) => {
    console.log('client connected');
    c.on('end', () => {
        console.log('client disconnected');
    });

    c.on("data", function(data){
        console.log(data.toString());
        var jsonContent = JSON.parse(data.toString());
        switch(jsonContent.exec) {
            case "getOffice":
                console.log("CASE GET DATA");
                sql('SELECT office.officeNr FROM office WHERE office.officeNr = ?', jsonContent.number, function(response){

                    if(response[0]!=null){
                        console.log(response[0].officeNr);
                        var onr = response[0].officeNr;
                        var obj = '{"exec":"setOffice", "exists":'+onr+'}';
                        console.log(obj);
                        c.write(obj+"\r\n");
                    }else{
                        console.log(response[0]);
                        var response_object = response[0];
                        var obj = '{"exec":"setOffice", "exists":'+response_object+'}';
                        console.log(obj);
                        c.write(obj+"\r\n");
                    }

                });
                break;
            case "getColor":
                var id = jsonContent.id;
                sql("SELECT faculty.color1, faculty.color2, faculty.color3 FROM office LEFT JOIN faculty on (faculty.id=office.facultyID) WHERE office.officeNr = ?", id,
                    function(response){
                        var ob = '{"exec":"setColor", "color_1":"'+response[0].color1+'", "color_2":"'+response[0].color2+'", "color_3":"'+response[0].color3+'"}';
                        console.log(response);
                        c.write(ob+"\r\n");
                    }
                );
                break;
            case "getData":
                var officeNumber = jsonContent.number;
                sql("SELECT user.id, user.unique_id, user.name, user.surname, user.positionTitle, user.status FROM user LEFT JOIN office ON user.officeID = office.officeID WHERE office.officeNr = ?",officeNumber, function(data){
                    //Schleife
                    var i;
                    for(i = 0; i < data.length; i++){
                        var dat = data[i];
                        var ob = '{ "exec":"setData", "id":'+dat.id+', "unique_id":'+dat.unique_id+', "firstname":"'+dat.name+'", "lastname":"'+dat.surname+'", "position":"'+dat.positionTitle+'", "status":"'+dat.status+'"}';
                        console.log(data[i]);
                        c.write(ob+"\r\n");
                    }
                });
                break;
            case "getOfficeHours":
                var unID = jsonContent.number;
                sql("SELECT * FROM officehours WHERE emp_id = ?",unID, function(data){
                    //Schleife
                    var j;
                    for(j = 0; j < data.length; j++){
                        var dat = data[j];
                        var ob = '{ "exec":"setOfficeHours", "id":'+unID+', "weekday":'+dat.weekday+', "starttime":"'+dat.starttime+'", "endtime":"'+dat.endtime+'"}';
                        console.log(data[j]);
                        c.write(ob+"\r\n");
                    }

                });
                break;
        }
    });
});

server.on('error', (err) => {
    throw err;
});

// server.listen(2001, () => {
//     console.log('server bound');
// });


    //Encrypt Password
    var genRandomString = function(length){
        return crypto.randomBytes(Math.ceil(length/2))
        .toString('hex')//Conversion to hex-format
        .slice(0,length);//return req. number of chars
    };

    var sha512 = function(password,salt){
        var hash = crypto.createHmac('sha512', salt);
        hash.update(password);
        var value = hash.digest('hex');
        return{
            salt: salt,
            passwordHash: value
        }
    };


    function saltHashPassword(userPassword){
        var salt = genRandomString(16);// generate random String with 16 characters
        var passwordData = sha512(userPassword,salt);
        return passwordData;
    }

    function checkHashPassword(userPassword, salt){
        var passwordData = sha512(userPassword,salt);
        return passwordData;
    }

    var app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    app.post('/register/',(req,res,next)=>{

        var post_data = req.body;// Get post Param

        var uid = uuid.v4();
        var plain_password = post_data.password;//Get password from post param
        var hash_data = saltHashPassword(plain_password);
        var password = hash_data.passwordHash;//Get hashValue
        var salt = hash_data.salt;// Get salt

        var name = post_data.name;
        var email = post_data.email;

        con.query('SELECT * FROM user where email = ?', [email], function(err,result,fields){
            con.on('error', function(err){
                console.log('[MYSQL ERROR]',err);
            });

            if(result && result.length)
                res.json('USER ALREADY EXISTS!!!');
            else
            {
                con.query('INSERT INTO `user`(`unique_id`, `name`, `email`, `encrypted_password`, `salt`, `created_at`, `updated_at`) VALUES (?,?,?,?,?,NOW(),NOW())',[uid, name, email,password, salt],function(err,result,fields){
                    con.on('error', function(err){
                        console.log('[MYSQL ERROR]', err);
                        res.json('Register error: ', err);
                });
                    res.json('Register successfull');
                })
            }
        });
    })    


    app.post('/login/', (req,res,next)=>{

        var post_data = req.body;

        //Extract Email and Password
        var user_password = post_data.password;
        var email = post_data.email;

        con.query('SELECT * FROM user where email = ?', [email], function(err,result,fields){
            con.on('error', function(err){
                console.log('[MYSQL ERROR]',err);
            });

            if(result && result.length)
            {
                var salt = result[0].salt;
                var encrypted_password = result[0].encrypted_password;
                var hashed_password = checkHashPassword(user_password,salt).passwordHash;
                if (encrypted_password == hashed_password){
                    res.end(JSON.stringify(result[0]))// If true, return all info uf the user
                }
                else
                {
                    res.end(JSON.stringify('WRONG PASSWORD'));
                }
            }
            else
            {
                res.json('USER DOES NOT EXISTS!!!');

            }
        });

    })

    //Start server
    app.listen(port,()=>{

        console.log(`App Runs on ${port}`);

    })


