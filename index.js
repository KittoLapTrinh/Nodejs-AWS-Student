const express = require('express')

const PORT = 3000

const app = express()

const multer = require('multer')
const AWS = require('aws-sdk')
require('dotenv').config();
const {error} = require('console')
const path = require('path')

//Cau hinh multer de luu tru file trong bo nho
const storage = multer.memoryStorage();

//Thiet lap multer
const upload = multer({
    storage: storage,
    limits: {fileSize: 2000000},
    fileFilter: function(req, file, cb){
        checkFileType(file, cb) 
    }
});
module.exports = upload;



//Cau hinh app
app.use(express.static("./views"))
app.set('view engine', 'ejs')
app.use(express.json({extended: false}))
app.set('views', './views');

//Cau hinh AWS
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = "1"
AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const bucketName = process.env.S3_BUCKET_NAME;
const tableName = process.env.DYNAMODB_TABLE_NAME;



//Ham kiem tra kieu file
function checkFileType(file, cb){
    const fileTypes = /jpeg|jpg|png|gif/;

    //kiem tra phan mo rong va kieu mime cua file
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype){
        return cb(null, true);
    }else{
        cb('Error!: Pls upload images /jpeg|jpg|png|gif/ only!' )

    }
}



//Routers
app.get('/', async(req,res) =>{
    try{
        const params = {TableName: tableName}; //Thiet lap bang DynamoDB
        const data = await dynamodb.scan(params).promise();
        return res.render("index.ejs", {data: data.Items}); //Render trang index.ejs va truyen du lieu
    }catch(error){
        console.error("Error retrieving data from DynamoDB:", error);
        return res.status(500).send('Internal Server Error')
    }
})

//Save
app.post("/save", upload.single('image'), (req, res) => {
    //Middleware upload.single("image") dam bao chi dinh rang field co name la "image" duoc upload
  
     // Xử lý việc lưu trữ dữ liệu vào DynamoDB sau khi upload file
     try{
        const maSinhVien = req.body.maSinhVien;
        const tenSinhVien = req.body.tenSinhVien;
        const gioiTinh = req.body.gioiTinh;
        const diemTrungBinh = req.body.diemTrungBinh;
        const chuyenNganh = req.body.chuyenNganh;
        const image = req.file?.originalname.split('.');
        const fileType = image[image.length-1];
        const filePath = `${maSinhVien}_${Date.now().toString()}.${fileType}`

        const paramsS3 = {
            Bucket : bucketName,
            Key : filePath,
            Body: req.file.buffer,
            ContenType: req.file.mimetype
        };

        s3.upload(paramsS3, async(err, data) =>{
            if(err){
                console.error("Error!" , err);
                return res.send("Internal Server error!");
            }else{
                const imageURL = data.Location;
                console.log('imageURL = ', imageURL );
                const paramsDynamoDB = {
                    TableName: tableName,
                    Item: {
                        maSinhVien: maSinhVien,
                        tenSinhVien: tenSinhVien,
                        gioiTinh: gioiTinh,
                        diemTrungBinh: diemTrungBinh,
                        chuyenNganh: chuyenNganh,
                        image: imageURL,
                    }
                };
                await dynamodb.put(paramsDynamoDB).promise();
                return res.redirect("/");
            }
        });
    }catch(error){
        console.log("Error saving data from DynamoDB:", error);
        return res.status(500).send("Internal Server Error!");
    }
});

// Delete
app.post('/delete', upload.fields([]), (req, res) =>{
    //console.log('DELETING...');
    const listCheckBoxSelected = Object.keys(req.body);
    if(!listCheckBoxSelected || listCheckBoxSelected.length <= 0){
        return res.redirect('/')
    }
    try{
        function onDeleteItem(length) { //Dinh nghia de quy xoa
            const params = {
                TableName: tableName,
                Key: {
                    "maSinhVien": listCheckBoxSelected[length]
                }
            }
            dynamodb.delete(params, (err,data) =>{
                if(err){
                    console.error("error", err);
                    return res.send("Interal Server Error!");
                }else{
                    if(length >0){
                        onDeleteItem(length - 1);
                    }else{
                        return res.redirect('/')
                    }
                }
            });
        }
        onDeleteItem(listCheckBoxSelected.length - 1); //Goi ham de quy xoa
    }catch(error){
        console.error("Error deleting data from DynamoDB: ", error);
        return res.status(500).send("Interal Server Error!");
    }
});

app.listen(3000, () =>{
    console.log("Running in port 3000...");
})

    


