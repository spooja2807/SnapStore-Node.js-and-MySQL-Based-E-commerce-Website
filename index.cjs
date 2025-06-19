var express=require('express')
var ejs=require('ejs')
var mysql=require('mysql2');


var app=express();
app.use(express.static('public'));
app.set('view engine','ejs');
app.listen(8080); 

var con=mysql.createConnection({
    host:"localhost",
    user:"root",
    password:'22bai1437',
    database:"ecommerce"
});
con.connect(function(err) {
    if (err) {
        console.error("Database connection failed: " + err.stack);
        return;
    }
    console.log("Connected to database.");
});

//localhost
app.get('/',function(req,res){
    con.query("SELECT * FROM products;",(err,result)=>{
        res.render('pages/website',{result:result});
});
});