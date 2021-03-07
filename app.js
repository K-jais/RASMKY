if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const express=require('express');
const path = require('path');
const ejsMate=require('ejs-mate');
const session = require('express-session');
const methodOverride = require('method-override');
var request = require('request');
const mongoose = require('mongoose');
const passport = require('passport');    // to authenticate
const LocalStrategy = require('passport-local');  // to authenticate
const User = require('./models/user');
const Order= require('./models/order');
const flash = require('connect-flash');

const { MongoStore } = require('connect-mongo');

const MongoDBStore=require('connect-mongo')(session);
const dbUrl=process.env.DB_URL;
// const dbUrl='mongodb://localhost:27017/rasmky32';
const app=express();
// 'mongodb://localhost:27017/rasmky32'
mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')))

const secret= process.env.SECRET || 'rasmky';

const store=new MongoDBStore({
    url:dbUrl,
    secret,
    touchAfter:24*60*60
});
store.on("error",function(e){
    console.log("Session store error",e);
});

const sessionConfig = {
    store,
    name:'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig))
app.use(flash());


app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());   // to store the user in some way
passport.deserializeUser(User.deserializeUser());  // to store the user in alternate way

app.use((req, res, next) => {
    console.log(req.session)
    res.locals.currentUser = req.user; //to have that user then flash it
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})
app.get('/',(req,res)=>{
    res.render('Landing');
})
app.get('/home',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    res.render('Home',{user});
})

app.get('/login',(req,res)=>{
    res.render('login');
})

app.post("/login",passport.authenticate("local",{
    failureFlash: true,
    successRedirect:"/home",
    failureRedirect:"/login"
}),function(req,res){

});

app.get('/register',(req,res)=>{
    res.render('register');
})

app.get('/logout', (req, res) => {
    req.logout();
    req.session.destroy(function (err) {
        res.redirect('/login'); //Inside a callback… bulletproof!
    });
})

app.post('/register',function(req,res){
    User.register(new User({username:req.body.username,firstname:req.body.firstname,email: req.body.email,lastname: req.body.lastname,city:req.body.city,address:[{name:req.body.firstname,add:req.body.address}],cart:{id:-1,carting:[{name:'KUSH',price:'299'}]}}),req.body.password,function(err,user){
        if(err){
        return res.render('register',{'error':err.message});
    }
        passport.authenticate("local")(req,res,function(){
            res.redirect('/home');
        });
    });
})

app.get('/City',async(req,res)=>{
    const user=await User.findById(req.user._id);
    var arr=['Mumbai','Delhi','Bangalore','Hyderabad','Ahmedabad','Chennai','Kolkata','Surat','Pune','Jaipur','Lucknow','Kanpur','Nagpur','Indore','Thane','Bhopal','Visakhapatnam','Patna','Vadodara','Ghaziabad','Ludhiana','Agra','Nashik','Ranchi','Faridabad','Meerut','Rajkot','Varanasi','Srinagar','Auranagabad','Amritsar','Allahabad','Howrah','Gwalior','Jabalpur','Coimbatore','Vijaywada','Jodhpur','Madurai','Raipur','Kota','Chandigarh','Guwahati','Mysore','Bareily','Gurugram','Noida','Jammu'];
    if(arr.includes(req.query.city))
    {
        let city=req.query.city;
        var city_id=null;
        var collections=null;
        var headers = {
            'Accept': 'application/json',
            'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
        };
    
        var options = {
            url: 'https://developers.zomato.com/api/v2.1/locations?query='+city,
            headers: headers
        };
        
        async function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                const info = JSON.parse(body);
                city_id=JSON.stringify(info);
                city_id= await JSON.parse(city_id);
                let id=city_id.location_suggestions[0].city_id;
                var options1 = {
                    url: 'https://developers.zomato.com/api/v2.1/collections?city_id='+id,
                    headers: headers
                };
                async function callback1(error,response,body){
                    if (!error && response.statusCode == 200) {
                        const info1 = JSON.parse(body);
                        collections=JSON.stringify(info1);
                        collections= await JSON.parse(collections);
                        collections=collections.collections;
                        var number=collections.length;
                        if(number>16)
                        number=16;
                        else
                        number=collections.length;
                        if(req.session.results!= null)
                        {
                            req.session.results=null;
                        }
                        if(req.session.cities!= null)
                        {
                            req.session.cities=null;
                        }
                        req.session.results=collections;
                        req.session.cities=city_id;
                        res.render('City',{city_id,collections,city,number,user});
                    }
                }
                request(options1, callback1);
            }
        }
        request(options, callback);
    }
})

app.get('/Category',async(req,res)=>{
    const user=await User.findById(req.user._id);
   let city=req.query.city;
   var city_id=null;
   var restaurants=null;
   var collection=null;
   var results=null;
   var headers = {
    'Accept': 'application/json',
    'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    city_id=req.session.cities;
    let lat=city_id.location_suggestions[0].latitude;
    let lon=city_id.location_suggestions[0].longitude;
        var options1 = {
            url: 'https://developers.zomato.com/api/v2.1/search?count=80&lat='+lat+'&lon='+lon+'&collection_id='+req.query.col_id,
             headers: headers
        };
        async function callback1(error,response,body){
            if (!error && response.statusCode == 200) {
                const info1=JSON.parse(body);
                restaurants=JSON.stringify(info1);
                restaurants=await JSON.parse(restaurants);
                results=req.session.results;
                for(let i=0;i<results.length;i++)
                {
                    if(results[i].collection.collection_id == req.query.col_id)
                    {
                        collection=results[i].collection;
                    }
                }  
                restaurants=restaurants.restaurants;
                res.render('Restaurant',{city_id,collection,restaurants,city,user});
            }
        }
    request(options1, callback1);
})

app.get('/Menu',async(req,res)=>{
    const user=await User.findById(req.user._id);
    let city=req.query.city;
    let col_id=req.query.col_id;
    let res_id=req.query.res_id;
    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+res_id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('Menu',{city,col_id,restaurant,user});
        }
    }
    request(options, callback);
})

app.get('/profile',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    res.render('profile',{user});
})

app.get('/newaddress',async(req,res)=>{
    res.render('Newaddress');
})


app.post('/newaddress',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    const title=req.body.title;
    const address=req.body.address;
    const b={
        name:title,
        add:address
    };
    user.address.push(b);
    await user.save();
    
    res.redirect('/profile');
   
})

app.post('/cart',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    var res_id= req.body.res_id;
    var cart= await JSON.parse(req.body.carting);
    if(user.cart.id == -1 && cart.length == 1 && user.cart.carting.length == 1){
        res.render('emptycart',{user});
    }
    else if(user.cart.id == -1 && cart.length>1){
    user.cart.id=res_id;
    for(let i=1;i<cart.length;i++)
    {
        user.cart.carting.push(cart[i]);
    }
    await user.save();

    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+res_id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('cart',{restaurant,user});
        }
    }
    request(options, callback);
}
else if(user.cart.id == res_id && cart.length == 1){
    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+res_id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('cart',{restaurant,user});
        }
    }
    request(options, callback);
}
else if(user.cart.id == res_id && cart.length>1){
    user.cart.carting=user.cart.carting.splice(0,1);
    await user.save();
    for(let i=1;i<cart.length;i++)
    {
        user.cart.carting.push(cart[i]);
    }
    await user.save();
    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+res_id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('cart',{restaurant,user});
        }
    }
    request(options, callback);
}
else if(user.cart.id != -1 && user.cart.id != res_id && cart.length == 1){
    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+user.cart.id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('cart',{restaurant,user});
        }
    }
    request(options, callback);
}
else if(user.cart.id != -1 && user.cart.id != res_id && cart.length > 1){
    user.cart.id=res_id;
    user.cart.carting=user.cart.carting.splice(0,1);
    await user.save();
    for(let i=1;i<cart.length;i++)
    {
        user.cart.carting.push(cart[i]);
    }
    await user.save();

    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+res_id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('cart',{restaurant,user});
        }
    }
    request(options, callback);

}
})

app.post('/tracking',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    const restaurant=await JSON.parse(req.body.restaurant_details);
    var user_cart=await JSON.parse(req.body.user_details);
    const address=req.body.address_details;
    const totalprice=req.body.totalprice_details;
    const date_date=req.body.date_date;
    const date_time=req.body.date_time;
    const order=new Order();
    order.author=req.user._id;
    order.restaurant.id=restaurant.id;
    order.restaurant.name=restaurant.name;
    order.restaurant.img=restaurant.featured_image;
    order.restaurant.price=restaurant.average_cost_for_two;
    order.restaurant.review=restaurant.user_rating.aggregate_rating;
    order.restaurant.cuisines=restaurant.cuisines;
    order.restaurant.timings=restaurant.timings;
    order.restaurant.address=restaurant.location.address;
    user_cart=user_cart.cart.carting;
    for(let i=1;i<user_cart.length;i++)
    {
        order.cart.push(user_cart[i]);
    }
    order.address=address;
    order.total_price=totalprice;
    order.date.date=date_date;
    order.date.time=date_time;
    user.order.push(order);
    await order.save();
    await user.save();
    user.cart.id=-1;
    user.cart.carting=user.cart.carting.splice(0,1);
    await user.save();
    res.render('tracking');
})

app.get('/orderhistory',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user == null)
    {
        res.redirect('/');
    }
    var orders=[];
    if(user.order.length < 1)
    {
        res.render('emptyorder',{user});
    }
    else{
        for(let i=0;i<user.order.length;i++)
    {
        var order=await Order.findById(user.order[i]);
        orders.push(order);
    }
    res.render('order',{user,orders});
    }
    
})

app.post('/reordercart',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    var order_id=req.body.order_id;
    const order=await Order.findById(order_id);
    user.cart.id=order.restaurant.id;
    for(let i=0;i<order.cart.length;i++)
    {
        user.cart.carting.push(order.cart[i]);
    }
    await user.save();
    var restaurant=null;
    var headers = {
        'Accept': 'application/json',
        'user-key': 'f266ecdb27ed72fe80e7aea6ec1598c9'
    };
    var options = {
        url: 'https://developers.zomato.com/api/v2.1/restaurant?res_id='+order.restaurant.id,
         headers: headers
    };
    async function callback(error,response,body){
        if (!error && response.statusCode == 200) {
            const info1=JSON.parse(body);
            restaurant=JSON.stringify(info1);
            restaurant=await JSON.parse(restaurant);
            res.render('cart',{user,restaurant});
        }
    }
    request(options, callback);
    
})

app.get('/removecart',async(req,res)=>{
    const user=await User.findById(req.user._id);
    if(user ==null)
    {
        res.redirect('/');
    }
    user.cart.id="-1";
    user.cart.carting=user.cart.carting.splice(0,1);
    await user.save();
    res.redirect('/home');
})

const port=process.env.PORT || 3000;

app.listen(port,()=>{
    console.log("Connected to port ${port}");
})