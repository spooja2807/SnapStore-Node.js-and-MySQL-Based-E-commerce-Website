var express=require('express')
var ejs=require('ejs')
var bodyParser=require('body-parser')
var mysql=require('mysql2');
const currencyFormatter = require('currency-formatter');


var app=express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

//multer-for uploading image files
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });
//home page
app.get('/', function(req, res) {
  const initialLimit =4;
  con.query("call get_limited_products(?,0);", [initialLimit], (err, result) => {
    if (err) throw err;

    con.query("CALL getcartitemcount(?)", [userId], (err2, countResult) => {
      if (err2) throw err2;

      const cartCount = countResult[0][0].count || 0;

      res.render('pages/website', {
        result: result[0],      
        cartCount: cartCount
      });
    });
  });
});

//infinte scroll
app.get('/load-products', (req, res) => {
    const limit = parseInt(req.query.limit);
    const offset = parseInt(req.query.offset);

    con.query("call get_limited_products(?,?);", [limit, offset], (err, result) => {
        if (err) return res.status(500).send("Database error");
        res.json(result[0]);
    });
});


// product details
app.get('/details/:id',function(req,res){
    
    const id=req.params.id;
    con.query("CALL getproduct(?)",[id],(err,result)=>{
        if (result[0].length === 0) {
            return res.status(404).send("Product not found");
        }
        const product = result[0][0];
        con.query("call cart_qty_for_btn(?,?)", [userId, id], (err2, cartResult) => {
            if (err2) throw err2;
             const qtyInCart = cartResult[0].length > 0 ? cartResult[0][0].qty : 0;
      // related products by same category
      con.query("call get_related_products(?,?)", [product.cid, id], (err3, relatedProducts) => {
        if (err3) throw err3;
       
      //reviews
      const reviewQuery ="call get_reviews(?)";
       con.query(reviewQuery, [id], (err, reviews) => {
      if (err) return res.send('Review Error');
       
      //average rating
        con.query("call get_average_rating(?)", [id], (err, avg) => {
      if (err) return res.status(500).send("Rating error");
      const avgRating = avg[0][0].avg_rating;
      res.render('pages/details', { product,qty: qtyInCart,related: relatedProducts[0],reviews:reviews[0], avgRating});
    });
    });
    });
});
});
});
app.get('/about', (req, res) => {
    res.render('pages/about');
});
app.get('/contact', (req, res) => {
    res.render('pages/contact');
});



// add to cart
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

// view cart
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

  con.query("call get_category_products(?);", [cid], (err, result) => {
    if (err) {
      res.send("Database error");
    } else {
      const brandset=new Set(result[0].map(item => item.brand));
      const brands = Array.from(brandset);
      res.render("pages/category", { products: result[0] ,brands:brands});
    }
  });
});

//user profile
app.get('/user', (req, res) => {
    
  con.query("call get_user_details(?);", [userId], (err, result) => {
    if (err) {
      res.send("Database error");
    }
 
  con.query("call get_user_orders(?);", [userId], (err2, items) => {
            if (err2) throw err2;
    res.render("pages/user", { user: result[0][0], items:items[0] });
  });
 });
});


// Increment Quantity
app.get('/cart/increment/:pid', (req, res) => {
    res.redirect(`/addtocart/${req.params.pid}`);
});

// Decrement quantity
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
//admin
app.get('/admin', (req, res) => {
  const msg = req.query.msg; 
  const productsQuery = `
    SELECT p.*, c.cname AS category_name 
    FROM products p 
    JOIN category c ON p.cid = c.cid
  `;

  con.query(productsQuery, (err, products) => {
    if (err) return res.send("Error fetching products");
    res.render("pages/admin", { products,msg });
  });
});
//admin add product
app.get('/addproduct', (req, res) => {

  con.query("SELECT * FROM category", (err, categories) => {
    if (err) return res.send("Error loading categories");
    res.render("pages/addproduct", { categories });
  });
});
app.post('/addproduct', upload.single('product_image'), (req, res) => {
  const { name, price, brand, qty, shortdes, description, cid } = req.body;
  const imgpath = req.file.filename;

  const sql = `
    call add_product(?, ?, ?, ?, ?, ?, ?, ?);
  `;
  con.query(sql, [name, price, imgpath, brand, qty, shortdes, description, cid], (err) => {
    if (err) {
      console.error(err);
      return res.redirect('/admin?msg=error');
    }
    res.redirect('/admin?msg=success');
  });
});
//admin delete product
app.get('/deleteproduct/:id', (req, res) => {

  con.query("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.send("Error deleting product");
    res.redirect('/admin');
  });
});

//review
app.post('/addreview/:id', (req, res) => {
  const prodId = req.params.id;
  const {rating,rtext}=req.body;
  con.query("call add_review(?, ?, ?, ?)", [userId, prodId, rating, rtext], (err, result) => {
    if (err) return res.send("Database Error");
    res.redirect('/details/' + prodId); 
  });
});