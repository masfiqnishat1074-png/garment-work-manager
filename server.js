
const express=require("express");
const path=require("path");
const Database=require("better-sqlite3");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const cors=require("cors");
const app=express();
const PORT=process.env.PORT||3000;
const SECRET=process.env.JWT_SECRET||"change-this-secret";
const db=new Database(process.env.DB_FILE||path.join(__dirname,"garment_v7.db"));
app.use(cors()); app.use(express.json()); app.use(express.static(path.join(__dirname,"public")));
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,password TEXT,name TEXT,department TEXT,role TEXT DEFAULT 'user',active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,buyer TEXT,po TEXT,style TEXT,color TEXT,qty INTEGER,shipment_date TEXT,production_pct INTEGER DEFAULT 0,status TEXT,merchandiser TEXT);
CREATE TABLE IF NOT EXISTS tna(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,activity TEXT,plan_date TEXT,actual_date TEXT,owner TEXT,status TEXT DEFAULT 'Pending',remarks TEXT);
CREATE TABLE IF NOT EXISTS samples(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,sample_type TEXT,submit_date TEXT,approval_date TEXT,status TEXT,department TEXT);
CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,material TEXT,required_qty REAL,inhouse_qty REAL,inspection TEXT,supplier TEXT,expected_date TEXT);
CREATE TABLE IF NOT EXISTS production(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,prod_date TEXT,section TEXT,target INTEGER,actual INTEGER);
CREATE TABLE IF NOT EXISTS inspections(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,inspect_date TEXT,inspector TEXT,inspect_type TEXT,result TEXT,comments TEXT);
CREATE TABLE IF NOT EXISTS shipments(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,cartons INTEGER,qty INTEGER,cbm REAL,exfactory_date TEXT,status TEXT);
CREATE TABLE IF NOT EXISTS master_data(id INTEGER PRIMARY KEY AUTOINCREMENT,buyer TEXT,style TEXT,color TEXT,size TEXT,ean TEXT);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT,entity TEXT,entity_id INTEGER,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
if(!db.prepare("SELECT 1 FROM users LIMIT 1").get()){
 db.prepare("INSERT INTO users(username,password,name,department,role) VALUES(?,?,?,?,?)").run("admin",bcrypt.hashSync("admin123",10),"Administrator","Admin","admin");
 db.prepare("INSERT INTO users(username,password,name,department,role) VALUES(?,?,?,?,?)").run("merch",bcrypt.hashSync("merch123",10),"Merchandising","Merchandising","user");
}
const auth=(req,res,next)=>{try{let h=req.headers.authorization||"";req.user=jwt.verify(h.replace("Bearer ",""),SECRET);next()}catch(e){res.status(401).json({error:"Login required"})}};
const admin=(req,res,next)=>req.user.role==="admin"?next():res.status(403).json({error:"Admin only"});
const log=(u,a,e,id,d="")=>db.prepare("INSERT INTO audit_log(user_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)").run(u,a,e,id,d);

app.post("/api/login",(req,res)=>{
 const u=db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(req.body.username);
 if(!u||!bcrypt.compareSync(req.body.password,u.password))return res.status(401).json({error:"Invalid login"});
 const token=jwt.sign({id:u.id,name:u.name,department:u.department,role:u.role},SECRET,{expiresIn:"7d"});
 res.json({token,user:{id:u.id,name:u.name,department:u.department,role:u.role}});
});
app.get("/api/dashboard",auth,(req,res)=>{
 const orders=db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
 const overdue=db.prepare(`SELECT t.*,o.po,o.style FROM tna t JOIN orders o ON o.id=t.order_id WHERE t.status!='Completed' AND t.plan_date<date('now')`).all();
 const samples=db.prepare(`SELECT s.*,o.po,o.style FROM samples s JOIN orders o ON o.id=s.order_id WHERE s.status!='Approved'`).all();
 const materials=db.prepare(`SELECT m.*,o.po,o.style,(m.required_qty-m.inhouse_qty) balance FROM materials m JOIN orders o ON o.id=m.order_id WHERE m.required_qty>m.inhouse_qty`).all();
 const inspections=db.prepare(`SELECT i.*,o.po,o.style FROM inspections i JOIN orders o ON o.id=i.order_id WHERE i.result='Pending'`).all();
 res.json({orders,overdue,samples,materials,inspections});
});
app.get("/api/orders",auth,(req,res)=>res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all()));
app.post("/api/orders",auth,(req,res)=>{let x=req.body;let r=db.prepare("INSERT INTO orders(buyer,po,style,color,qty,shipment_date,production_pct,status,merchandiser) VALUES(?,?,?,?,?,?,?,?,?)").run(x.buyer,x.po,x.style,x.color,x.qty,x.shipment_date,x.production_pct||0,x.status||"On Track",x.merchandiser||"");log(req.user.id,"CREATE","order",r.lastInsertRowid,x.po);res.json({id:r.lastInsertRowid})});
app.delete("/api/orders/:id",auth,(req,res)=>{db.prepare("DELETE FROM orders WHERE id=?").run(req.params.id);log(req.user.id,"DELETE","order",req.params.id);res.json({ok:true})});
const modules={
tna:{table:"tna",sql:"INSERT INTO tna(order_id,activity,plan_date,actual_date,owner,status,remarks) VALUES(?,?,?,?,?,?,?)",fields:["order_id","activity","plan_date","actual_date","owner","status","remarks"]},
samples:{table:"samples",sql:"INSERT INTO samples(order_id,sample_type,submit_date,approval_date,status,department) VALUES(?,?,?,?,?,?)",fields:["order_id","sample_type","submit_date","approval_date","status","department"]},
materials:{table:"materials",sql:"INSERT INTO materials(order_id,material,required_qty,inhouse_qty,inspection,supplier,expected_date) VALUES(?,?,?,?,?,?,?)",fields:["order_id","material","required_qty","inhouse_qty","inspection","supplier","expected_date"]},
production:{table:"production",sql:"INSERT INTO production(order_id,prod_date,section,target,actual) VALUES(?,?,?,?,?)",fields:["order_id","prod_date","section","target","actual"]},
inspections:{table:"inspections",sql:"INSERT INTO inspections(order_id,inspect_date,inspector,inspect_type,result,comments) VALUES(?,?,?,?,?,?)",fields:["order_id","inspect_date","inspector","inspect_type","result","comments"]},
shipments:{table:"shipments",sql:"INSERT INTO shipments(order_id,cartons,qty,cbm,exfactory_date,status) VALUES(?,?,?,?,?,?)",fields:["order_id","cartons","qty","cbm","exfactory_date","status"]}
};
for(const [name,m] of Object.entries(modules)){
 app.get("/api/"+name,auth,(req,res)=>res.json(db.prepare(`SELECT x.*,o.po,o.style,o.color FROM ${m.table} x JOIN orders o ON o.id=x.order_id ORDER BY x.id DESC`).all()));
 app.post("/api/"+name,auth,(req,res)=>{let vals=m.fields.map(f=>req.body[f]??"");let r=db.prepare(m.sql).run(...vals);log(req.user.id,"CREATE",name,r.lastInsertRowid);res.json({id:r.lastInsertRowid})});
}
app.post("/api/tna/:id/complete",auth,(req,res)=>{db.prepare("UPDATE tna SET status='Completed',actual_date=date('now') WHERE id=?").run(req.params.id);log(req.user.id,"UPDATE","tna",req.params.id,"Completed");res.json({ok:true})});
app.get("/api/master",auth,(req,res)=>res.json(db.prepare("SELECT * FROM master_data ORDER BY id DESC").all()));
app.post("/api/master",auth,(req,res)=>{let x=req.body;r=db.prepare("INSERT INTO master_data(buyer,style,color,size,ean) VALUES(?,?,?,?,?)").run(x.buyer,x.style,x.color,x.size,x.ean);res.json({id:r.lastInsertRowid})});
app.post("/api/ean-check",auth,(req,res)=>{let codes=req.body.codes||[];res.json(codes.map(code=>({code,match:db.prepare("SELECT * FROM master_data WHERE ean=?").get(code)||null})))});
app.get("/api/users",auth,admin,(req,res)=>res.json(db.prepare("SELECT id,username,name,department,role,active FROM users ORDER BY id").all()));
app.post("/api/users",auth,admin,(req,res)=>{let x=req.body;try{let r=db.prepare("INSERT INTO users(username,password,name,department,role) VALUES(?,?,?,?,?)").run(x.username,bcrypt.hashSync(x.password,10),x.name,x.department,x.role||"user");res.json({id:r.lastInsertRowid})}catch(e){res.status(400).json({error:"Username already exists"})}});
app.get("/api/audit",auth,admin,(req,res)=>res.json(db.prepare("SELECT a.*,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 500").all()));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Garment Work Manager V7 running on port ${PORT}`));
