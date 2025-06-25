var express=require('express')
var ejs=require('ejs')
var bodyParser=require('body-parser')
var mysql=require('mysql2');
const currencyFormatter = require('currency-formatter');
//var session=require('express-session');


var app=express();
app.use(express.static('public'));
app.set('view engine','ejs');
app.listen(8080);

const userId='pooja_28'; //dummy user

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
//cart item count 

app.use((req, res, next) => {
  if (userId) {

con.query("CALL getcartitemcount(?)", [userId], (err, countResult) => {

      if (err) {
        console.error(err);
        res.locals.cartItemCount = 0;
      } else {
        res.locals.cartItemCount = countResult[0][0].count || 0;
      }
      next();
    });
  } else {
    res.locals.cartItemCount = 0;
    next();
  }
});

//localhost
// app.get('/',function(req,res){
//     con.query("CALL getproducts()",(err,result)=>{
//         res.render('pages/website',{result:result[0]});
// });
// });
app.get('/', function(req, res) {
    // Replace with actual user ID, e.g., from session

    con.query("CALL getproducts()", (err, result) => {
        if (err) throw err;

        // Now fetch cart item count
        con.query("CALL getcartitemcount(?)", [userId], (err2, countResult) => {
            if (err2) throw err2;

            // Assume procedure returns [{ count: X }]
            const cartCount = countResult[0][0].count || 0;

            res.render('pages/website', {
                result: result[0],
                cartCount: cartCount
            });
        });
    });
});

// product details
app.get('/details/:id',function(req,res){
    
    const id=req.params.id;
    con.query("CALL getproduct(?)",[id],(err,result)=>{
        if (result[0].length === 0) {
            return res.status(404).send("Product not found");
        }
        con.query("SELECT qty FROM cart WHERE userid = ? AND prodid = ?", [userId, id], (err2, cartResult) => {
            if (err2) throw err2;
             const qtyInCart = cartResult.length > 0 ? cartResult[0].qty : 0;
        res.render('pages/details', { product: result[0][0],qty: qtyInCart });
    });
});
});
app.get('/about', (req, res) => {
    res.render('pages/about');
});
app.get('/contact', (req, res) => {
    res.render('pages/contact');
});

// ADD TO CART
app.get('/addtocart/:id', (req, res) => {
    const prodId = req.params.id;
    con.query("CALL addtocart(?, ?);", [prodId, userId], (err, result) => {
        if (err) {
            console.error("Add to cart error:", err);
            return res.status(500).send("Could not add item to cart.");
        }
        res.redirect('/cart');
    });
});

// VIEW CART
app.get('/cart', (req, res) => {
    
    con.query("CALL getcartitems(?);", [userId], (err, result) => {
        if (err) {
            console.error("Error fetching cart items:", err);
            return res.status(500).send("Database error");
        }
        res.render("pages/cart", { cart: result[0] });
    });
});

//category
app.get('/category/:cid', (req, res) => {
  const cid = req.params.cid;

  con.query("SELECT p.id,p.name, p.imgpath, p.price,p.brand, c.cname FROM products p JOIN category c ON p.cid = c.cid WHERE p.cid = ? and p.qty>0", [cid], (err, result) => {
    if (err) {
      res.send("Database error");
    } else {
      const brandset=new Set(result.map(item => item.brand));
      const brands = Array.from(brandset);
      res.render("pages/category", { products: result ,brands:brands});
    }
  });
});




// INCREMENT QUANTITY
app.get('/cart/increment/:pid', (req, res) => {
    res.redirect(`/addtocart/${req.params.pid}`);
});

// DECREMENT QUANTITY
app.get('/cart/decrement/:pid', (req, res) => {
    const pid = req.params.pid;
    con.connect(err => {
        if (err) return res.status(500).send("Database connection error");

        const sql = 'UPDATE cart SET qty = qty - 1 WHERE userid = ? AND prodid = ? AND qty > 0;'
        con.query(sql, [userId, pid], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database update error");
            }

            // Delete if quantity hits 0
            const deleteSql = `DELETE FROM cart WHERE userid = ? AND prodid = ? AND qty = 0`;
            con.query(deleteSql, [userId, pid], () => {
                res.redirect('/cart');
            });
        });
    });
});

app.locals.formatCurrency = function (amount) {
  return currencyFormatter.format(amount, { code: 'INR' });
};

//order placement
app.post('/place-order', (req, res) => {

  con.query("SELECT c.prodid,c.qty,p.price,p.imgpath FROM cart c join products p on c.prodid=p.id WHERE userid = ?", [userId], (err, cartItems) => {
    if (err) return res.send("Error fetching cart");

    if (cartItems.length === 0) return res.send("Cart is empty!");

    const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

    con.query("INSERT INTO orders (userid, total_amt) VALUES (?, ?)", [userId, total], (err, orderResult) => {
      if (err) return res.send("Error placing order: " + err.sqlMessage);


      const orderId = orderResult.insertId;
      const orderItems = cartItems.map(item => [orderId, item.prodid, item.qty, item.price]);

      con.query("INSERT INTO order_items (order_id, prod_id, qty, price) VALUES ?", [orderItems], (err) => {
        if (err) return res.send("Error adding order items");

        con.query("DELETE FROM cart WHERE userid = ?", [userId], (err) => {
          if (err) return res.send("Order placed, but cart not cleared");
          con.query("SELECT date FROM orders WHERE oid = ?", [orderId], (err, dateResult) => {
  if (err) return res.send("Error fetching order date");

  const orderDate = dateResult[0].date;
          res.render("pages/orders", {
          
          orderId,
          orderDate,
          total,
          items: cartItems
        }); 
        });
      });
    });
  });
});
});
