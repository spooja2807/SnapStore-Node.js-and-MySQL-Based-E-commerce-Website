import mysql from 'mysql2'
import dotenv from 'dotenv'
dotenv.config()
const pool=mysql.createPool({
    host:process.env.MYSQL_HOST,
    user:process.env.MYSQL_USER,
    password:process.env.MYSQL_PASSWORD,
    database:process.env.MYSQL_DATABASE
}).promise()

//list all products
async function getProducts(){
    const [result]=await pool.query("SELECT * FROM products")
    return result
}
const prod=await getProducts()
console.log(prod)
//list all users
async function getUsers(){
    const [result]=await pool.query("SELECT * FROM user")
    return result
}
const user=await getUsers()
console.log(user)

//list all category
async function getCategory(){
    const [result]=await pool.query("SELECT * FROM category")
    return result
}
const result=await getCategory()
console.log(result)

//specific id
async function getNote(id){
    const [rows]=await pool.query('SELECT * FROM PRODUCTS WHERE ID=?',[id])
        return rows[0]
}
// const note=await getNote(10)
// console.log(note)