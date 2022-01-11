//jshint esversion:6
require("dotenv").config();
var helper = require("./date");
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
var findOrCreate = require("mongoose-findorcreate");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const timestamp = require("mongoose-timestamp");
const querystring = require("querystring");
// -----------------------

var fs = require("fs");
var path = require("path");
const multer = require("multer");

// -----------------------------
const app = express();
var flash = require("connect-flash");
app.use(flash());
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

app.use(
  session({
    secret: "Our Little Secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
  res.locals.isAuthenticated = req.isAuthenticated();

  if (req.user) {
    res.locals.name = req.user.name;
    res.locals.username = req.user.email;
    res.locals.id = req.user._id;
    // console.log("Now you are logged in!");
  } else if (!req.user) {
    console.log("you are not logged in!");
  }

  next();
});

mongoose.connect(process.env.DB_MONGO_URL, {
  useNewUrlParser: true,
});

//mongoose.connect("mongodb://localhost:27017/GrindGeekDB", {useNewUrlParser: true});

const Schema = require("mongoose").Schema;

// --------------------------Schema----------------------

const quesSchema = new mongoose.Schema(
  {
    Body: String,
    askedby: { type: Schema.Types.ObjectId, ref: "User" },
    askEmail: String,
    upvote: {
      type: Number,
      default: 0,
    },
    upvoteBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    answers: [
      {
        answer: String,
        answeredBy: { type: Schema.Types.ObjectId, ref: "User" },
        upvote: {
          type: Number,
          default: 0,
        },
        time: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    report: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

quesSchema.index({ "$**": "text" });

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    img: {
      data: Buffer,
      contentType: String,
    },
    googleId: String,
    facebookId: String,
    QuestionsAsked: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    QuestionsAnswered: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    upvotedQuestion: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    reportedQuestion: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    upvotedAnswer: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    Contribute: {
      type: Number,
      default: 0
    },
    Accountdate: String,

    time: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema({
  message: String,
  relatedTo: { type: Schema.Types.ObjectId, ref: "User" },
  questionNotif: { type: Schema.Types.ObjectId, ref: "Question" },
  time: {
    type: Date,
    default: Date.now,
  },
});

//Questions Model
const Question = mongoose.model("Question", quesSchema);

userSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});

userSchema.plugin(findOrCreate);

//Creating a Mongoose Model
const User = new mongoose.model("User", userSchema);

const Notification = mongoose.model("Notification", notificationSchema);
// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

//Google Strategy-------------------

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "https://sleepy-beyond-92271.herokuapp.com/auth/google/main",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      let getEmail = profile.emails[0].value;
      User.findOrCreate(
        { googleId: profile.id, name: profile.displayName, email: getEmail },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

app.get(
  "/auth/google/main",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/main");
  }
);

//Google Strategy-------------------

// ------------------facebook Auth----------------
var FacebookStrategy = require("passport-facebook").Strategy;
const e = require("connect-flash");

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.APP_ID,
      clientSecret: process.env.APP_SECRET,
      callbackURL:
        "https://sleepy-beyond-92271.herokuapp.com/auth/facebook/main",
      profileFields: ["id", "emails", "name"],
    },
    function (accessToken, refreshToken, profile, cb) {
      let getEmail = profile.emails[0].value;
      let getName = profile.name.givenName;
      User.findOrCreate(
        { facebookId: profile.id, name: getName, email: getEmail },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

app.get(
  "/auth/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
  })
);

app.get(
  "/auth/facebook/main",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    // console.log(req.user, req.isAuthenticated());
    res.redirect("/main");
  }
);

// ------------------facebook Auth--------------------

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/login");
});

app.get("/", (req, res) => {
  res.render("Landing");
});

//Login Route----------------------
var messages;
app.get("/flash", function (req, res) {
  // Set a flash message by passing the key, followed by the value, to req.flash().
  req.flash("info", "Email or password not matched!");
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/main");
  } else {
    res.render("login", { messages: req.flash("info") });
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/main",
    failureRedirect: "/flash",
    failureFlash: true,
  })
);

passport.authenticate("local", { successFlash: "Welcome!" });
passport.authenticate("local", {
  failureFlash: "Invalid username or assword.",
});

// //Login Route----------------------

app.get("/secrets", (req, res) => {
  if (req.isAuthenticated()) {
    // console.log("request approved.");
    res.render("secrets");
  } else {
    // console.log("request is not approved.");
    res.redirect("/login");
  }
});

//Signup Routes start-------------

var error;

app.get("/Signup", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/main");
  } else {
    res.render("Signup", { error: error });
  }
});

app.post("/Signup", (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  if (name.length < 3) {
    res.render("Signup", { error: "the name must have minimum length of 3" });
  } else if (password.length < 6) {
    res.render("Signup", {
      error: "your password should have min and max length between 6-15",
    });
  } else {
    User.register(
      {
        name: req.body.name,
        email: req.body.email,
      },
      req.body.password,
      (err, user) => {
        if (err) {
          err = " A user with the given email is already registered!";
          res.render("Signup", { error: err });

          console.log(err);
        } else {
          passport.authenticate("local")(req, res, () => {
            // console.log("it is authenticating!");
            res.redirect("/fetch");
          });
        }
      }
    );
  }
});

app.get("/fetch", (req, res) => {
  // console.log("fetch API is called!");
  User.findById(res.locals.id, (err, user) => {
    var date = new Date(user.createdAt); // dateStr you get from mongodb
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getFullYear();
    d = d.toString(10);
    m = m.toString(10);
    y = y.toString(10);

    var myDate = d + "-" + m + "-" + y;
    user.Accountdate = myDate;
    user.save();

    const notification = new Notification({
      message: "Just Signup On The Grind Geeks",
      relatedTo: user._id,
    });

    notification.save((err) => {
      if (err) console.log(err);
      else {
        // console.log("successfully created new notification!");
      }
    });
  });
  res.redirect("/main");
});

//Signup Routes ends-------------

app.get("/grindgeeks", (req, res) => {
  res.render("Landing");
  // res.send('dfewhfo');
});

app.get("/about", (req, res) => {
  res.render("About");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function () {
  console.log("Server started Successfully");
});

// ----------------------Code for Main ejs------------------------

app.get("/god", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("God");
  } else {
    res.redirect("/login");
  }
});

//User route

app.get("/user", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("user");
  } else {
    res.render("login", { messages: req.flash("info") });
  }
});

//Question main route

app.get("/user/:id", (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.params.id, (err, foundUser) => {
      if (!err) {
        res.render("user", {
          foundUser: foundUser,
        });

        // console.log(foundUser);
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/targetUser/:id", (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.params.id, (err, foundUser) => {
      if (!err) {
        res.render("targetUser", {
          foundUser: foundUser,
        });

        // console.log(foundUser);
      }
    });
  } else {
    res.redirect("/login");
  }
});
// -------------------ask route---------------

app.post("/ask", (req, res) => {
  if (req.isAuthenticated()) {
    const question = new Question({
      Body: req.body.question,
      askedby: res.locals.id,
      upvote: 0,
    });

    question.save((err, savedQuestion) => {
      if (err) console.log(err);
      else {
        User.findOne({ _id: res.locals.id }, (err, foundUser) => {
          if (err) console.log(err);
          else {
            // console.log(savedQuestion.id);
            // console.log(foundUser);
            const notification = new Notification({
              message: "Posted A New Question",
              relatedTo: res.locals.id,
              questionNotif: savedQuestion._id,
            });
            notification.save((err) => {
              if (err) console.log(err);
              else {
                // console.log("successfully created new notification!");
              }
            });
            // console.log("data pushed");

            foundUser.QuestionsAsked.push(savedQuestion._id);
            foundUser.Contribute++;
            foundUser.save();
          }
        });
      }
    });

    res.redirect("/main");
  } else {
    res.redirect("/login");
  }
});

// -----------------------------------------

app.get("/ask", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("ask");
  } else {
    res.redirect("/login");
  }
});

// -------------------main route---------------

let allNames = [];

app.get("/main", (req, res) => {

  var List1 = mongoose.model("User");
  var List2 = mongoose.model("Question");

 
  
  List1.find({})
    .sort({ Contribute: -1 })
        .exec(function (err, users) {
          List2.find({})
          .sort("-upvote")
          .populate("askedby")
          .exec(function (err, foundQuestions) {
            if (err) {
              console.log(err);
            } else {
              res.render("main", {
                users: users,
                questions: foundQuestions,
              });
            }
          });
        });
  
});

// -------------------Question route---------------
app.get("/question", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("question");
  } else {
    res.redirect("/login");
  }
});

var unique;
var user1;

app.get("/questions/:customQuestion", (req, res) => {
  
    const question_number = req.params.customQuestion;
    unique = question_number;
    //  console.log(question_number);
    Question.findOne({ _id: question_number })
      .populate("askedby")
      .populate("answers.answeredBy")
      .exec(function (err, foundQuestion) {
        if (err) {
          console.log(err);
        } else {
          res.render("question", {
            Question: foundQuestion,
          });
        }
      });
 
});

app.post("/answer", (req, res) => {
  if (req.isAuthenticated()) {
    Question.findById(unique, (err, foundQuestion) => {
      if (err) console.log(err);
      else {
        const answer = {
          answer: req.body.yourAnswer,
          answeredBy: res.locals.id,
        };
        foundQuestion.answers.push(answer);
        foundQuestion.save();
        User.findById(res.locals.id, (err, foundUser) => {
          foundUser.QuestionsAnswered.push(unique);
          foundUser.Contribute++;
          foundUser.save();
        });
        res.redirect("/questions/" + unique);
      }
    });
  } else {
    res.redirect('/login');
  }

  
});

// -------------------------------------------------------

// ----------------uploading the image-----------------

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now());
  },
});

var upload = multer({ storage: storage });

app.post("/upload", upload.single("image"), (req, res, next) => {
  if (req.isAuthenticated()) {
    User.findById(res.locals.id, (err, foundUser) => {
      if (err) console.log(err);
      else {
        foundUser.img.data = fs.readFileSync(
          path.join(__dirname + "/uploads/" + req.file.filename)
        );
        foundUser.img.contentType = "image/png";
        foundUser.save();
  
        setTimeout(function () {
          res.redirect("user/" + res.locals.id);
        }, 3000);
      }
    });
  } else {
    res.redirect('/login');
  }

});

// ----------------All Users route------------------------

app.post("/getEdu", (req, res) => {
  if (req.isAuthenticated()) {
    var gotValue = req.body.inp1;
    User.find({}, (err, users) => {});
  } else {
    res.redirect('/login');
  }

});

app.get("/allUsers", (req, res) => {
  if (req.isAuthenticated()) {
    User.find({}, (err, users) => {
      res.render("allUsers", { users: users });
    });
  } else {
    res.redirect("/login");
  }
});

// ---------------------Question upvote -- downvote section --------------------

app.get("/upvote/:id", (req, res) => {
  if (req.isAuthenticated()) {
    function Insert(id) {
      User.findById(res.locals.id, (err, user) => {
        user.upvotedQuestion.push(id);
   

        user.save();
      });
    }
  
    function Increment(id) {
      Question.findByIdAndUpdate(
        id,
        { $inc: { upvote: 1 } },
        function (err, response) {
          if (err) {
            console.log(err);
          } else {
            // console.log("Successfully increment the question vote!");
          }
        }
      );
    }
  
    User.findById(res.locals.id, (err, user) => {
      if (err) console.log(err);
      else {
        if (user.upvotedQuestion.indexOf(req.params.id) !== -1) {
          // console.log("Yes, the value exists!");
          res.redirect("/main");
        } else {
          // console.log("No, the value is absent.");
          Insert(req.params.id);
          Increment(req.params.id);
          res.redirect("/main");
          // console.log("Value is Inserted Successfully!.");
        }
      }
    });
  }
  else {
    res.redirect('/login');
  }

});

app.get("/downvote/:id", (req, res) => {

  if (req.isAuthenticated()) {
    function remove(id) {
      User.findByIdAndUpdate(
        res.locals.id,
        { $pull: { upvotedQuestion: id } },
     
        (err, data) => {
          if (err) {
            return res.status(500).json({ error: "error in deleting address" });
          }
          // console.log("successfully removed from upvoted!");
        }
      );
    }
  
    function Decrement(id) {
      Question.findByIdAndUpdate(
        id,
        { $inc: { upvote: -1 } },
        function (err, response) {
          if (err) {
            console.log(err);
          } else {
            // console.log("Successfully Decrement the question vote!");
          }
        }
      );
    }
  
    User.findById(res.locals.id, (err, user) => {
      if (err) console.log(err);
      else {
        if (user.upvotedQuestion.indexOf(req.params.id) !== -1) {
          // console.log("Yes, the upvote exists! Going to downvote!");
          remove(req.params.id);
          Decrement(req.params.id);
          res.redirect("/main");
        } else {
          // console.log("No, the upvote is absent. can't downvote further");
  
          res.redirect("/main");
        }
      }
    });
  } else {
    res.redirect('/login');
  }

});

// ---------------------Answer upvote -- downvote section --------------------

app.get("/answerUpvote/:id/:question_id", (req, res) => {
  if (req.isAuthenticated()) {
    var currQuestion = req.params.question_id;

    function Insert(id) {
      User.findById(res.locals.id, (err, user) => {
        user.upvotedAnswer.push(id);
        user.save();
      });
    }
  
    function Increment(id) {
      Question.findById(
        currQuestion,
        { answers: { $elemMatch: { _id: id } } },
        (err, foundAnswer) => {
          // console.log(foundAnswer.answers[0].upvote);
          ++foundAnswer.answers[0].upvote;
          // console.log("Successfully increamented the upvote count of answer");
          foundAnswer.save();
        }
      );
    }
  
    User.findById(res.locals.id, (err, user) => {
      if (err) console.log(err);
      else {
        if (user.upvotedAnswer.indexOf(req.params.id) !== -1) {
          // console.log("User has already upvoted the answer!");
          res.redirect("/questions/" + currQuestion);
        } else {
          // console.log("No,User has not upvoted the answer!.");
          Insert(req.params.id);
          Increment(req.params.id);
          setTimeout(function () {
            res.redirect("/questions/" + currQuestion);
          }, 500);
  
          // console.log("User has  upvoted the answer!.Successfully!.");
        }
      }
    });
  } else {
    res.redirect('/login');
  }

});

app.get("/answerDownvote/:id/:question_id", (req, res) => {
  if (req.isAuthenticated()) {
    var currQuestion = req.params.question_id;
    function remove(id) {
      User.findByIdAndUpdate(
        res.locals.id,
        { $pull: { upvotedAnswer: id } },
        (err, data) => {
          if (err) {
            return res.status(500).json({ error: "error in deleting address" });
          }
          // console.log("successfully removed from upvoted!");
        }
      );
    }
  
    function Decrement(id) {
      Question.findById(
        currQuestion,
        { answers: { $elemMatch: { _id: id } } },
        (err, foundAnswer) => {
          console.log(foundAnswer.answers[0].upvote);
          --foundAnswer.answers[0].upvote;
          //  console.log("Successfully increamented the upvote count of answer");
          foundAnswer.save();
        }
      );
    }
  
    User.findById(res.locals.id, (err, user) => {
      if (err) console.log(err);
      else {
        if (user.upvotedAnswer.indexOf(req.params.id) !== -1) {
          // console.log("Yes, the upvote exists! Going to downvote!");
          remove(req.params.id);
          Decrement(req.params.id);
          setTimeout(function () {
            res.redirect("/questions/" + currQuestion);
          }, 1000);
        } else {
          // console.log("No, the upvote is absent. can't downvote further");
  
          res.redirect("/questions/" + currQuestion);
        }
      }
    });
   } else {
    res.redirect('/login');

  }

});

// -----------------------------------------------------------------------------

// report route---------------

// var temp;
app.get("/report/:currQuestion", (req, res) => {
  if (req.isAuthenticated()) {
    temp = req.params.currQuestion;
    // console.log(temp);
    res.render("report", {
      id: temp,
    });
  } else {
    res.redirect('/login');
  }

});

app.post("/report/:currQuestion", (req, res) => {
  if (req.isAuthenticated()) {
    var Question_id = req.params.currQuestion;

    function Insert(id) {
      User.findById(res.locals.id, (err, user) => {
        user.reportedQuestion.push(id);
        user.save();
      });
    }
  
    function Increment(id) {
      Question.findByIdAndUpdate(
        id,
        { $inc: { report: 1 } },
        function (err, response) {
          if (err) {
            console.log(err);
          } else {
            // console.log("Successfully reported the question !");
          }
        }
      );
    }
  
    User.findById(res.locals.id, (err, user) => {
      if (err) console.log(err);
      else {
        if (user.reportedQuestion.indexOf(Question_id) !== -1) {
          // console.log("You have already reported the question!");
          res.redirect("/main");
        } else {
          // console.log("No, You have not reported the question");
          Insert(Question_id);
          Increment(Question_id);
          res.redirect("/main");
        }
      }
    });
  } else {
    res.redirect('/login');
  }

});

// --------------------------trending.js-------------------------

app.get("/trending", (req, res) => {
  
    Question.find({})
      .sort({ time: -1 })
      .populate("askedby")
      .sort({ upvote: -1 })
      .exec(function (err, questions) {
        if (err) console.log(err);
        else {
          res.render("trending", {
            Questions: questions,
          });
        }
      });
 
});

// --------------Notification.js------------------------

app.get("/notification", function (req, res) {
  if (req.isAuthenticated()) {
    var List1 = mongoose.model("Notification");
    var List2 = mongoose.model("User");

    List1.find({})
      .sort("-time")
      .populate("relatedTo")
      .populate("questionNotif")
      .exec(function (err, notifications) {
        List2.findById(res.locals.id, function (err, foundUser) {
          res.render("notification", {
            notifications: notifications,
            User: foundUser,
          });
        });
      });
  } else {
    res.redirect("/login");
  }
});



// -----------------user upvoted asked answered route-------------

app.get("/user/sortUser/:id/:sign", (req, res) => {

  if (req.isAuthenticated()) {
    const currUser = req.params.id;
    const currSign = req.params.sign;
  
    res.redirect("/list/" + currUser + "/" + currSign);
  } else {
    res.redirect("/login");
  }
});

app.get("/list/:currUser/:currSign", function (req, res) {

  if (req.isAuthenticated()) {
    const userId = req.params.currUser;
    const currSign = req.params.currSign;
  
    if (currSign == "Answered") {
      User.findById(userId)
        .populate("QuestionsAnswered")
        .exec(function (err, foundUser) {
          if (err) {
            console.log(err);
          } else {
            res.render("list", {
              foundUser: foundUser,
              sign: "Answered",
            });
          }
        });
    } else if (currSign == "Upvoted") {
      User.findById(userId)
        .populate("upvotedQuestion")
        .exec(function (err, foundUser) {
          if (err) {
            console.log(err);
          } else {
            res.render("list", {
              foundUser: foundUser,
              sign: "Upvoted",
            });
          }
        });
    } else if (currSign == "Asked") {
      User.findById(userId)
        .populate("QuestionsAsked")
        .exec(function (err, foundUser) {
          if (err) {
            console.log(err);
          } else {
            res.render("list", {
              foundUser: foundUser,
              sign: "Asked",
            });
          }
        });
    }
  } else {
    res.redirect('/login');
  }
 
});
