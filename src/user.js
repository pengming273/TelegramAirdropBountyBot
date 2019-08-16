var mongoose= require('mongoose');

//user Schema
var UserSchema = mongoose.Schema({
    ethAddress:{
        type: String,
        required: true
    
    },
    twitterUser:{
        type: String,
        required: false
    
    },
    telegramUser:{
        type: String,
        required:true
    },
    refNumber:{
        type: String,
        required: true
    },
    refBy: {
        type: String,
        required: false
    },
    bitcointalk: {
        type: String,
        required: false
    },
    medium: {
        type: String,
        required: false
    },
    instagram: {
        type: String,
        required: false
    },
    creationDate: {
        type : String,
        required:false
    }
});

module.exports=mongoose.model('User',UserSchema);
