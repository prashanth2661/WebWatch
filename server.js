const port=4000;
const exp=require('express')
const app=exp();
//To extract body of req
app.use(exp.json())

const cors = require('cors');
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));


const mongoose=require('mongoose');
mongoose.connect('mongodb+srv://agitheyeshwanth:Yeshwanth%402003@cluster0.mnak9.mongodb.net/ExamMonitorDB').then(()=>console.log("DB connected"))
//sample route
app.get('/',(req,res)=>{
  res.send('express app is running')
})

//schema for creating exams
const Exams=mongoose.model('Exams',{
  name:{
    type:String,
    required:true,
  },
  url:{
    type:String,
    required:true,    
  },
  code:{
    type:String,
    required:true,
  },
  duration:{
    type:Number,
    required:true,
  },
  rollnos:{
    type:Array,
    required:true,
    default:[],
  }
})
app.post('/addexam',async(req,res)=>{
  let newexam=req.body;
  // console.log(newexam);
  let exams=await Exams.find({code:newexam.code});
  // console.log(exams);
  if(exams && exams.length ){
    res.json({
      success:false,
      message:"code already exist",
    })
    return;
  }
  let result=await Exams.insertMany([{...newexam}])
  res.json({
    success:true,
    name:newexam.name,
  })
})
app.post('/getexam',async(req,res)=>{
  // console.log("code",req.body);
  let exam=await Exams.find({code:req.body.code});
  if(exam && exam.length){
    res.json({
      success:true,
      exam:{
        name:exam[0].name,
        url:exam[0].url,
        duration:exam[0].duration,
        code:exam[0].code,
      },
    })
    return;
  }
  res.json({
    success:false,
  })
})
app.post('/addrollno',async(req,res)=>{
  // let exam=await Exams.find({code:req.body.code});
  let examCode=req.body.code;
  let rollno=req.body.rollno;
  let result = await Exams.updateOne(
    { code: examCode, rollnos: { $ne: rollno } }, 
    { $push: { rollnos: rollno } }  
  );
  if (result.modifiedCount === 0) {
    res.json({
      success: false,
    });
    return;
  }
  res.json({
    success: true,
  });
})
// app.post('/removeexam',async(req,res)=>{
//
// })

//error handling
app.use((err,req,res,next)=>{
  res.send({message:'error',payload:err.message})
})
//assigning port number
app.listen(port,()=>console.log('server on port '+port))