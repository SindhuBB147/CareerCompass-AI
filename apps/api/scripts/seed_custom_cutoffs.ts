import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/career-compass-dev';

const CutoffSchema = new mongoose.Schema(
  {
    collegeId: { type: String, required: true },
    courseId: { type: String, required: true },
    courseName: String,
    examCode: { type: String, required: true },
    year: { type: Number, required: true },
    round: { type: Number, required: true },
    category: { type: String, required: true },
    branch: String,
    closingRank: { type: Number, required: true },
    source: { type: String, default: 'official' },
    verifiedBy: String,
    metadata: mongoose.Schema.Types.Mixed,
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CutoffSchema.index(
  { collegeId: 1, courseId: 1, examCode: 1, category: 1, year: -1, round: 1 },
  { unique: true }
);

const CutoffModel = mongoose.model('Cutoff', CutoffSchema);

const rawBlock1 = `
2024,All Rounds,E001,"Acharya Institute of Technology-Soladevanahalli, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,78979;29367,29367,min_closing_rank,"Multiple rows found"
2024,All Rounds,E001,"Acharya Institute of Technology-Soladevanahalli, Bengaluru",GM,BD-Bachelor of Design,3,74477;66375;61684,61684,min_closing_rank,"Multiple rows found"
2024,All Rounds,E001,"Acharya Institute of Technology-Soladevanahalli, Bengaluru",KKR,BD-Bachelor of Design,3,44419;53948;70849,44419,min_closing_rank,"Multiple rows found"
2025,Round 4,E001,"Acharya Institute of Technology-Soladevanahalli, Bengaluru",GM,AE- Aeronautical Engineering,2,56571;87540,56571,min_closing_rank,"Multiple rows found"
2025,Round 4,E001,"Acharya Institute of Technology-Soladevanahalli, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,99107;103486,99107,min_closing_rank,"Multiple rows found"
2024,All Rounds,E004,"Adichunchanagiri Institute Of Technology-Jyothi Nagara, Chikkamagaluru",GM,BD-Bachelor of Design,2,74192;94331,74192,min_closing_rank,"Multiple rows found"
2025,Round 4,E005,"Akash Institute of Engineering and Technology-Devanahalli, Bengaluru Rural",GM,AD-Artificial Intelligence & Data Science,2,84613;84459,84459,min_closing_rank,"Multiple rows found"
2024,All Rounds,E006,"Alvas Institute of Engineering and Technology-Moodbidri, Mangaluru",GM,BD-Bachelor of Design,2,96523;66409,66409,min_closing_rank,"Multiple rows found"
2024,All Rounds,E007,"AMC Engineering College-Bannerghatta Rd, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,4,96420;92567;69742;82125,69742,min_closing_rank,"Multiple rows found"
2024,All Rounds,E007,"AMC Engineering College-Bannerghatta Rd, Bengaluru",GM,BD-Bachelor of Design,3,100328;100868;75402,75402,min_closing_rank,"Multiple rows found"
2024,All Rounds,E007,"AMC Engineering College-Bannerghatta Rd, Bengaluru",KKR,BD-Bachelor of Design,2,86862;94314,86862,min_closing_rank,"Multiple rows found"
2025,Round 4,E007,"AMC Engineering College-Bannerghatta Rd, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,110976;102932,102932,min_closing_rank,"Multiple rows found"
2024,All Rounds,E012,"Atria Institute of Technology-Hebbal, Bengaluru",GM,BD-Bachelor of Design,3,67494;82217;91245,67494,min_closing_rank,"Multiple rows found"
2025,Round 4,E012,"Atria Institute of Technology-Hebbal, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,85194;105457,85194,min_closing_rank,"Multiple rows found"
2024,All Rounds,E015,"B.N.M. Institute of Technology-Banashankari, Bengaluru",GM,BD-Bachelor of Design,2,30741;40347,30741,min_closing_rank,"Multiple rows found"
2024,All Rounds,E015,"B.N.M. Institute of Technology-Banashankari, Bengaluru",KKR,BD-Bachelor of Design,2,40955;51705,40955,min_closing_rank,"Multiple rows found"
2025,Round 4,E015,"B.N.M. Institute of Technology-Banashankari, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,43182;91589,43182,min_closing_rank,"Multiple rows found"
2024,All Rounds,E016,"KLE Technological University Formerly known as BVBCET- Vidyanagar, Hubballi",GM,AI-Artificial Intelligence & Machine Learning,3,49639;94080;101378,49639,min_closing_rank,"Multiple rows found"
2025,Round 4,E016,"KLE Technological University Formerly known as BVBCET-Vidyanagar, Hubballi",GM,AI-Artificial Intelligence & Machine Learning,4,47299;111127;105816;81153,47299,min_closing_rank,"Multiple rows found"
2025,Round 4,E016,"KLE Technological University Formerly known as BVBCET-Vidyanagar, Hubballi",GM,AR- Automation & Robotics Engineering,2,106607;73602,73602,min_closing_rank,"Multiple rows found"
2024,All Rounds,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,15770;68680;80613,15770,min_closing_rank,"Multiple rows found"
2024,All Rounds,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AVE-Automotive Engineering,2,67183;23115,23115,min_closing_rank,"Multiple rows found"
2024,All Rounds,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,BD-Bachelor of Design,3,13221;10896;18608,10896,min_closing_rank,"Multiple rows found"
2024,All Rounds,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",KKR,AVE-Automotive Engineering,2,67840;44732,44732,min_closing_rank,"Multiple rows found"
2024,All Rounds,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",KKR,BD-Bachelor of Design,3,26792;19966;30504,19966,min_closing_rank,"Multiple rows found"
2025,Round 4,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,16423;30233,16423,min_closing_rank,"Multiple rows found"
2025,Round 4,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AE- Aeronautical Engineering,2,32635;24466,24466,min_closing_rank,"Multiple rows found"
2025,Round 4,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,5,22868;18272;99675;54276;99493,18272,min_closing_rank,"Multiple rows found"
2025,Round 4,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AL-Agriculture Engineering Course,2,68852;42283,42283,min_closing_rank,"Multiple rows found"
2025,Round 4,E019,"Bangalore Institute of Technology-V V Puram, Bengaluru",GM,AS-Aerospace Engineering,2,51158;24965,24965,min_closing_rank,"Multiple rows found"
2024,All Rounds,E021,"Bapuji Institute of Engineering and Technology-Shamanur Road, Davangere",GM,BD-Bachelor of Design,3,81541;76181;101492,76181,min_closing_rank,"Multiple rows found"
2024,All Rounds,E021,"Bapuji Institute of Engineering and Technology-Shamanur Road, Davangere",KKR,BD-Bachelor of Design,2,88677;74407,74407,min_closing_rank,"Multiple rows found"
2024,All Rounds,E024,"Basaveshwar Engineering College-Vidya Nagar, Bagalkote",GM,AI-Artificial Intelligence & Machine Learning,2,92752;99685,92752,min_closing_rank,"Multiple rows found"
2024,All Rounds,E024,"Basaveshwar Engineering College-Vidya Nagar, Bagalkote",GM,BD-Bachelor of Design,2,97717;91890,91890,min_closing_rank,"Multiple rows found"
2024,All Rounds,E026,"BLDEAs V.P. Dr.P.G.Halakatti College of Engineering and Technology-Ashram Road, Vijayapura",GM,BD-Bachelor of Design,3,75081;93560;77074,75081,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AG-Agriculture Engineering,2,40333;58288,40333,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,4962;61017;25036,4962,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AL-Agricultural Engineering,2,4444;4024,4024,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AS-Aerospace Engineering,2,16466;6782,6782,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,BD-Bachelor of Design,2,3733;3716,3716,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",KKR,AI-Artificial Intelligence & Machine Learning,2,10281;77487,10281,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",KKR,AL-Agricultural Engineering,2,13813;10638,10638,min_closing_rank,"Multiple rows found"
2024,All Rounds,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",KKR,BD-Bachelor of Design,2,7825;6652,6652,min_closing_rank,"Multiple rows found"
2025,Round 4,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,5885;5312,5312,min_closing_rank,"Multiple rows found"
2025,Round 4,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AE- Aeronautical Engineering,2,7904;6143,6143,min_closing_rank,"Multiple rows found"
2025,Round 4,E027,"BMS College of Engineering-Basavanagudi, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,4,6686;5610;47626;21793,5610,min_closing_rank,"Multiple rows found"
2024,All Rounds,E028,"BMS Institute of Technology and Management-Yelahanka, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,18563;36264;46274,18563,min_closing_rank,"Multiple rows found"
2025,Round 4,E028,"BMS Institute of Technology and Management-Yelahanka, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,4,26313;98837;47837;68406,26313,min_closing_rank,"Multiple rows found"
2024,All Rounds,E032,"C.M.R. Institute of Technology-Brookefield, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,46575;24260,24260,min_closing_rank,"Multiple rows found"
2024,All Rounds,E032,"C.M.R. Institute of Technology-Brookefield, Bengaluru",GM,BD-Bachelor of Design,3,29977;22032;53068,22032,min_closing_rank,"Multiple rows found"
2024,All Rounds,E032,"C.M.R. Institute of Technology-Brookefield, Bengaluru",KKR,AI-Artificial Intelligence & Machine Learning,2,50273;49792,49792,min_closing_rank,"Multiple rows found"
2024,All Rounds,E032,"C.M.R. Institute of Technology-Brookefield, Bengaluru",KKR,BD-Bachelor of Design,3,55443;38556;61870,38556,min_closing_rank,"Multiple rows found"
2025,Round 4,E032,"C.M.R. Institute of Technology-Brookefield, Bengaluru",GM,AD-Artificial Intelligence & Data Science,3,36348;26892;26223,26223,min_closing_rank,"Multiple rows found"
2025,Round 4,E032,"C.M.R. Institute of Technology-Brookefield, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,34791;29052,29052,min_closing_rank,"Multiple rows found"
2024,All Rounds,E033,"Cambridge Institute of Technology-K R Puram, Bengaluru",GM,BD-Bachelor of Design,3,56799;81358;89496,56799,min_closing_rank,"Multiple rows found"
2025,Round 4,E033,"Cambridge Institute of Technology-K R Puram, Bengaluru",GM,AE- Aeronautical Engineering,2,88739;93618,88739,min_closing_rank,"Multiple rows found"
2025,Round 4,E033,"Cambridge Institute of Technology-K R Puram, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,111359;85816,85816,min_closing_rank,"Multiple rows found"
2024,All Rounds,E035,"Channabasaveshwara Institute of Technology- Gubbi, Tumakuru",GM,BD-Bachelor of Design,2,101925;89505,89505,min_closing_rank,"Multiple rows found"
2024,All Rounds,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,46478;48711,46478,min_closing_rank,"Multiple rows found"
2024,All Rounds,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",GM,AL-Agricultural Engineering,2,54565;83190,54565,min_closing_rank,"Multiple rows found"
2024,All Rounds,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",GM,BD-Bachelor of Design,3,50393;47289;91258,47289,min_closing_rank,"Multiple rows found"
2024,All Rounds,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",KKR,AI-Artificial Intelligence & Machine Learning,2,37892;47322,37892,min_closing_rank,"Multiple rows found"
2024,All Rounds,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",KKR,BD-Bachelor of Design,3,38595;46617;59021,38595,min_closing_rank,"Multiple rows found"
2025,Round 4,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,54107;58956,54107,min_closing_rank,"Multiple rows found"
2025,Round 4,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",GM,AE- Aeronautical Engineering,2,108621;86367,86367,min_closing_rank,"Multiple rows found"
2025,Round 4,E039,"Dayananda Sagar Academy of Technology and Management-Kanakpura Road, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,68369;91599,68369,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AE-Aeronautical Engineering,2,43057;9492,9492,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AG-Agriculture Engineering,2,75923;42918,42918,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,6927;99998,6927,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AL-Agricultural Engineering,3,9116;7553;8634,7553,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AVE-Automotive Engineering,2,52159;11500,11500,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,BD-Bachelor of Design,3,6689;5873;8418,5873,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",KKR,AE-Aeronautical Engineering,2,68274;22498,22498,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",KKR,AI-Artificial Intelligence & Machine Learning,2,13569;74799,13569,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",KKR,AL-Agricultural Engineering,3,19497;14089;20086,14089,min_closing_rank,"Multiple rows found"
2024,All Rounds,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",KKR,BD-Bachelor of Design,3,14035;11753;17381,11753,min_closing_rank,"Multiple rows found"
2025,Round 4,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AD-Artificial Intelligence & Data Science,3,63821;7819;12335,7819,min_closing_rank,"Multiple rows found"
2025,Round 4,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AE- Aeronautical Engineering,3,37450;17651;10204,10204,min_closing_rank,"Multiple rows found"
2025,Round 4,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AG- Agricultural Engineering,2,81432;71114,71114,min_closing_rank,"Multiple rows found"
2025,Round 4,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,5,9622;8322;68618;36048;55934,8322,min_closing_rank,"Multiple rows found"
2025,Round 4,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AR- Automation & Robotics Engineering,2,11261;9105,9105,min_closing_rank,"Multiple rows found"
2025,Round 4,E040,"Dayananda Sagar College of Engineering-Kumaraswamy Layout, Bengaluru",GM,AS-Aerospace Engineering,3,53019;30129;10627,10627,min_closing_rank,"Multiple rows found"
2024,All Rounds,E041,"DON BOSCO Institute of Technology-Kumbalgodu, Bengaluru",GM,BD-Bachelor of Design,2,98982;64523,64523,min_closing_rank,"Multiple rows found"
2025,Round 4,E041,"DON BOSCO Institute of Technology-Kumbalgodu, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,71736;78693,71736,min_closing_rank,"Multiple rows found"
2024,All Rounds,E042,"Dr. Ambedkar Institute of Technology-Malathahalli, Bengaluru",GM,BD-Bachelor of Design,2,57489;96203,57489,min_closing_rank,"Multiple rows found"
2024,All Rounds,E042,"Dr. Ambedkar Institute of Technology-Malathahalli, Bengaluru",KKR,BD-Bachelor of Design,2,49404;65476,49404,min_closing_rank,"Multiple rows found"
2025,Round 4,E042,"Dr. Ambedkar Institute of Technology-Malathahalli, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,84409;110247,84409,min_closing_rank,"Multiple rows found"
2024,All Rounds,E046,"East Point College of Engineering and Technology- Avalahalli, Bengaluru",GM,BD-Bachelor of Design,2,100510;87738,87738,min_closing_rank,"Multiple rows found"
2025,Round 4,E046,"East Point College of Engineering and Technology-Avalahalli, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,59837;86011,59837,min_closing_rank,"Multiple rows found"
2024,All Rounds,E048,"East West Institute of Technology-BEL Layout, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,86818;94434,86818,min_closing_rank,"Multiple rows found"
2024,All Rounds,E048,"East West Institute of Technology-BEL Layout, Bengaluru",GM,BD-Bachelor of Design,2,89319;63334,63334,min_closing_rank,"Multiple rows found"
2024,All Rounds,E050,"Global Academy of Technology-Rajarajeshwari Nagar, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,70074;87157,70074,min_closing_rank,"Multiple rows found"
2024,All Rounds,E050,"Global Academy of Technology-Rajarajeshwari Nagar, Bengaluru",GM,BD-Bachelor of Design,2,98020;85615,85615,min_closing_rank,"Multiple rows found"
2024,All Rounds,E050,"Global Academy of Technology-Rajarajeshwari Nagar, Bengaluru",KKR,BD-Bachelor of Design,2,86885;56198,56198,min_closing_rank,"Multiple rows found"
2025,Round 4,E050,"Global Academy of Technology-Rajarajeshwari Nagar, Bengaluru",GM,AD-Artificial Intelligence & Data Science,3,55758;94669;110697,55758,min_closing_rank,"Multiple rows found"
2024,All Rounds,E051,"GM Institute of Technology-P B Road, Davangere",GM,BD-Bachelor of Design,2,99703;78191,78191,min_closing_rank,"Multiple rows found"
2024,All Rounds,E053,"Gopalan College of Engineering And Management- Whitefield, Bengaluru",GM,BD-Bachelor of Design,2,75233;98511,75233,min_closing_rank,"Multiple rows found"
2025,Round 4,E053,"Gopalan College of Engineering And Management-Whitefield, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,65974;89034,65974,min_closing_rank,"Multiple rows found"
2024,All Rounds,E055,"GSSS Institute of Engineering and Technology for Women- Metagalli, Mysuru",GM,BD-Bachelor of Design,2,35762;69773,35762,min_closing_rank,"Multiple rows found"
2025,Round 4,E055,"GSSS Institute of Engineering and Technology for Women-Metagalli, Mysuru",GM,AD-Artificial Intelligence & Data Science,3,74720;56718;54607,54607,min_closing_rank,"Multiple rows found"
2024,All Rounds,E059,"Jawaharlal Nehru New College of Engineering JNNCE- Swalanga Road, Shivamogga",GM,BD-Bachelor of Design,3,79577;66504;96532,66504,min_closing_rank,"Multiple rows found"
2025,Round 4,E059,"Jawaharlal Nehru New College of Engineering JNNCE-Swalanga Road, Shivamogga",GM,AI-Artificial Intelligence & Machine Learning,2,92366;103564,92366,min_closing_rank,"Multiple rows found"
2024,All Rounds,E060,"JSS Academy of Technical Education-Kengeri Main Road, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,49402;68354;61324,49402,min_closing_rank,"Multiple rows found"
2024,All Rounds,E060,"JSS Academy of Technical Education-Kengeri Main Road, Bengaluru",GM,BD-Bachelor of Design,2,41133;100258,41133,min_closing_rank,"Multiple rows found"
2024,All Rounds,E060,"JSS Academy of Technical Education-Kengeri Main Road, Bengaluru",KKR,BD-Bachelor of Design,2,49549;57402,49549,min_closing_rank,"Multiple rows found"
2025,Round 4,E060,"JSS Academy of Technical Education-Kengeri Main Road, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,68949;61469,61469,min_closing_rank,"Multiple rows found"
2025,Round 4,E060,"JSS Academy of Technical Education-Kengeri Main Road, Bengaluru",GM,AS-Aerospace Engineering,2,107604;100246,100246,min_closing_rank,"Multiple rows found"
2024,All Rounds,E061,JSS Science and Technology University-Mysuru,GM,AI-Artificial Intelligence & Machine Learning,2,55170;77186,55170,min_closing_rank,"Multiple rows found"
2025,Round 4,E061,JSS Science and Technology University-Mysuru,GM,AD-Artificial Intelligence & Data Science,2,16101;15742,15742,min_closing_rank,"Multiple rows found"
2025,Round 4,E061,JSS Science and Technology University-Mysuru,GM,AI-Artificial Intelligence & Machine Learning,2,81346;93758,81346,min_closing_rank,"Multiple rows found"
2024,All Rounds,E073,"KLS Gogte Institute of Technology-Udyambag, Belagavi",GM,BD-Bachelor of Design,2,41505;67705,41505,min_closing_rank,"Multiple rows found"
2024,All Rounds,E073,"KLS Gogte Institute of Technology-Udyambag, Belagavi",KKR,BD-Bachelor of Design,2,47299;72438,47299,min_closing_rank,"Multiple rows found"
2025,Round 4,E073,"KLS Gogte Institute of Technology-Udyambag, Belagavi",GM,AD-Artificial Intelligence & Data Science,2,43970;65197,43970,min_closing_rank,"Multiple rows found"
2025,Round 4,E073,"KLS Gogte Institute of Technology-Udyambag, Belagavi",GM,AE- Aeronautical Engineering,2,101565;79437,79437,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,3864;11355,3864,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AG-Agriculture Engineering,4,37954;33687;9112;65186,9112,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,4,3706;2175;81716;26545,2175,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AS-Aerospace Engineering,3,18772;5798;93650,5798,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,BD-Bachelor of Design,2,1585;3115,1585,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",KKR,AG-Agriculture Engineering,3,73147;11470;77118,11470,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",KKR,AI-Artificial Intelligence & Machine Learning,4,7073;7815;89944;68711,7073,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",KKR,AS-Aerospace Engineering,3,76076;10929;88553,10929,min_closing_rank,"Multiple rows found"
2024,All Rounds,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",KKR,BD-Bachelor of Design,2,3383;7776,3383,min_closing_rank,"Multiple rows found"
2025,Round 4,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,5885;5312,5312,min_closing_rank,"Multiple rows found"
2025,Round 4,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AE- Aeronautical Engineering,2,7904;6143,6143,min_closing_rank,"Multiple rows found"
2025,Round 4,E077,"M.S. Ramaiah Institute of Technology-MSR Nagar, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,4,6686;5610;47626;21793,5610,min_closing_rank,"Multiple rows found"
2024,All Rounds,E078,"Maharaja Institute of Technology-Belawadi, Mandya",GM,AI-Artificial Intelligence & Machine Learning,2,99162;84628,84628,min_closing_rank,"Multiple rows found"
2024,All Rounds,E078,"Maharaja Institute of Technology-Belawadi, Mandya",GM,BD-Bachelor of Design,3,91255;91204;98310,91204,min_closing_rank,"Multiple rows found"
2025,Round 4,E078,"Maharaja Institute of Technology-Belawadi, Mandya",GM,AD-Artificial Intelligence & Data Science,2,98718;111099,98718,min_closing_rank,"Multiple rows found"
2025,Round 4,E078,"Maharaja Institute of Technology-Belawadi, Mandya",GM,AI-Artificial Intelligence & Machine Learning,2,101827;106871,101827,min_closing_rank,"Multiple rows found"
2024,All Rounds,E079,"Malnad College of Engineering-Rangoli Halla, Hassan",GM,BD-Bachelor of Design,2,77630;94452,77630,min_closing_rank,"Multiple rows found"
2024,All Rounds,E080,"Mangalore Institute of Technology and Engineering- Moodbidri, Mangaluru",GM,AI-Artificial Intelligence & Machine Learning,2,56518;54572,54572,min_closing_rank,"Multiple rows found"
2024,All Rounds,E084,"Nagarjuna College of Engineering And Technology- Devanahalli, Bengaluru",GM,BD-Bachelor of Design,2,69101;98172,69101,min_closing_rank,"Multiple rows found"
2024,All Rounds,E085,"The National Institute of Engineering North Campus- Koorgalli, Mysuru",GM,BD-Bachelor of Design,2,10182;18058,10182,min_closing_rank,"Multiple rows found"
2024,All Rounds,E085,"The National Institute of Engineering North Campus- Koorgalli, Mysuru",KKR,BD-Bachelor of Design,2,18382;30296,18382,min_closing_rank,"Multiple rows found"
2025,Round 4,E085,"The National Institute of Engineering North Campus-Koorgalli, Mysuru",GM,AD-Artificial Intelligence & Data Science,2,25039;24347,24347,min_closing_rank,"Multiple rows found"
2024,All Rounds,E086,"Nitte Meenakshi Institute of Technology-Yelahanka, Bengaluru",GM,AE-Aeronautical Engineering,2,69535;74280,69535,min_closing_rank,"Multiple rows found"
2024,All Rounds,E086,"Nitte Meenakshi Institute of Technology-Yelahanka, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,19117;93852;77414,19117,min_closing_rank,"Multiple rows found"
2024,All Rounds,E086,"Nitte Meenakshi Institute of Technology-Yelahanka, Bengaluru",GM,BD-Bachelor of Design,2,15820;25502,15820,min_closing_rank,"Multiple rows found"
2024,All Rounds,E086,"Nitte Meenakshi Institute of Technology-Yelahanka, Bengaluru",KKR,AE-Aeronautical Engineering,2,77431;88135,77431,min_closing_rank,"Multiple rows found"
2024,All Rounds,E086,"Nitte Meenakshi Institute of Technology-Yelahanka, Bengaluru",KKR,BD-Bachelor of Design,2,28292;34193,28292,min_closing_rank,"Multiple rows found"
2024,All Rounds,E089,"P.E.S.College of Engineering-PES College Road, Mandya",GM,BD-Bachelor of Design,3,70362;54992;77308,54992,min_closing_rank,"Multiple rows found"
2025,Round 4,E089,"P.E.S.College of Engineering-PES College Road, Mandya",GM,AD-Artificial Intelligence & Data Science,3,62004;82113;49355,49355,min_closing_rank,"Multiple rows found"
2025,Round 4,E089,"P.E.S.College of Engineering-PES College Road, Mandya",GM,AI-Artificial Intelligence & Machine Learning,3,71221;110449;66533,66533,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,AG-Agriculture Engineering,3,21320;16403;3086,3086,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,738;37093;10449,738,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,AS-Aerospace Engineering,3,4991;1636;26722,1636,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,BD-Bachelor of Design,3,593;434;799,434,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",KKR,AG-Agriculture Engineering,2,35060;8527,8527,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",KKR,AI-Artificial Intelligence & Machine Learning,3,2235;62399;29784,2235,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",KKR,AS-Aerospace Engineering,3,23801;5164;50005,5164,min_closing_rank,"Multiple rows found"
2024,All Rounds,E095,"R V College of Engineering-Mysore Road, Bengaluru",KKR,BD-Bachelor of Design,3,2122;592;2053,592,min_closing_rank,"Multiple rows found"
2025,Round 4,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,975;692,692,min_closing_rank,"Multiple rows found"
2025,Round 4,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,5,890;20917;2424;17533;7032,890,min_closing_rank,"Multiple rows found"
2025,Round 4,E095,"R V College of Engineering-Mysore Road, Bengaluru",GM,AS-Aerospace Engineering,3,6429;13038;1790,1790,min_closing_rank,"Multiple rows found"
2024,All Rounds,E104,"RNS Institute of Technology-R R Nagar Post, Bengaluru",GM,BD-Bachelor of Design,2,45051;32495,32495,min_closing_rank,"Multiple rows found"
2024,All Rounds,E104,"RNS Institute of Technology-R R Nagar Post, Bengaluru",KKR,BD-Bachelor of Design,2,45451;36634,36634,min_closing_rank,"Multiple rows found"
2025,Round 4,E104,"RNS Institute of Technology-R R Nagar Post, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,46906;42678,42678,min_closing_rank,"Multiple rows found"
2025,Round 4,E104,"RNS Institute of Technology-R R Nagar Post, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,3,48497;89917;89591,48497,min_closing_rank,"Multiple rows found"
2024,All Rounds,E107,"SJB Institute of Technology-Kengeri, Bengaluru",GM,BD-Bachelor of Design,3,58622;97889;62793,58622,min_closing_rank,"Multiple rows found"
2024,All Rounds,E107,"SJB Institute of Technology-Kengeri, Bengaluru",KKR,BD-Bachelor of Design,2,69144;96667,69144,min_closing_rank,"Multiple rows found"
2025,Round 4,E107,"SJB Institute of Technology-Kengeri, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,103454;111065,103454,min_closing_rank,"Multiple rows found"
2024,All Rounds,E108,"S J C Institute of Technology-BB Road, Chikkaballapur",GM,BD-Bachelor of Design,2,93381;96958,93381,min_closing_rank,"Multiple rows found"
2024,All Rounds,E109,"S.E.A. College of Engineering and Technology-K R Puram, Bengaluru",GM,BD-Bachelor of Design,2,69642;75342,69642,min_closing_rank,"Multiple rows found"
2024,All Rounds,E112,"Sahyadri College of Engineering and Management-Adyar, Mangaluru",GM,BD-Bachelor of Design,2,84435;75240,75240,min_closing_rank,"Multiple rows found"
2024,All Rounds,E113,"Sai Vidya Institute of Technology-Rajan Kunte, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,99332;94065,94065,min_closing_rank,"Multiple rows found"
2024,All Rounds,E113,"Sai Vidya Institute of Technology-Rajan Kunte, Bengaluru",GM,BD-Bachelor of Design,3,79444;94982;85556,79444,min_closing_rank,"Multiple rows found"
2024,All Rounds,E116,"Sapthagiri NPS University-Hesarghatta Main Road, Bengaluru",GM,BD-Bachelor of Design,2,77605;50970,50970,min_closing_rank,"Multiple rows found"
2024,All Rounds,E117,"SDM College of Engineering and Technology, Tulu Minority- Kalaghatagi, Dharwad",GM,AI-Artificial Intelligence & Machine Learning,3,62180;41241;67872,41241,min_closing_rank,"Multiple rows found"
2024,All Rounds,E117,"SDM College of Engineering and Technology, Tulu Minority- Kalaghatagi, Dharwad",GM,BD-Bachelor of Design,2,51370;93687,51370,min_closing_rank,"Multiple rows found"
2024,All Rounds,E117,"SDM College of Engineering and Technology, Tulu Minority- Kalaghatagi, Dharwad",KKR,BD-Bachelor of Design,2,38815;50985,38815,min_closing_rank,"Multiple rows found"
2025,Round 4,E117,"SDM College of Engineering and Technology, Tulu Minority-Kalaghatagi, Dharwad",GM,AI-Artificial Intelligence & Machine Learning,2,75645;104133,75645,min_closing_rank,"Multiple rows found"
2024,All Rounds,E125,"Siddaganga Institute of Technology-B H Road, Tumakuru",GM,BD-Bachelor of Design,3,11173;82084;20586,11173,min_closing_rank,"Multiple rows found"
2024,All Rounds,E125,"Siddaganga Institute of Technology-B H Road, Tumakuru",KKR,BD-Bachelor of Design,2,18329;30487,18329,min_closing_rank,"Multiple rows found"
2025,Round 4,E125,"Siddaganga Institute of Technology-B H Road, Tumakuru",GM,AD-Artificial Intelligence & Data Science,2,20772;19691,19691,min_closing_rank,"Multiple rows found"
2024,All Rounds,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AG-Agriculture Engineering,2,44411;29786,29786,min_closing_rank,"Multiple rows found"
2024,All Rounds,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,29055;51958,29055,min_closing_rank,"Multiple rows found"
2024,All Rounds,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AVE-Automotive Engineering,2,58747;50334,50334,min_closing_rank,"Multiple rows found"
2024,All Rounds,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,BD-Bachelor of Design,3,26562;23106;33556,23106,min_closing_rank,"Multiple rows found"
2024,All Rounds,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",KKR,BD-Bachelor of Design,3,54325;47632;52424,47632,min_closing_rank,"Multiple rows found"
2025,Round 4,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,36563;73039,36563,min_closing_rank,"Multiple rows found"
2025,Round 4,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AE- Aeronautical Engineering,2,74763;47216,47216,min_closing_rank,"Multiple rows found"
2025,Round 4,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,5,41674;37806;96996;106568;102189,37806,min_closing_rank,"Multiple rows found"
2025,Round 4,E126,"Sir M.Visvesvaraya Institute of Technology-Yelahanka, Bengaluru",GM,AS-Aerospace Engineering,2,78423;53985,53985,min_closing_rank,"Multiple rows found"
2024,All Rounds,E137,"Sri Venkateshwara College of Engineering-KIAL Road, Bengaluru",GM,BD-Bachelor of Design,3,58994;98588;67279,58994,min_closing_rank,"Multiple rows found"
2024,All Rounds,E142,"The National Institute of Engineering South Campus- Mananthavady Road, Mysuru",GM,AI-Artificial Intelligence & Machine Learning,2,59393;95259,59393,min_closing_rank,"Multiple rows found"
2025,Round 4,E142,"The National Institute of Engineering South Campus-Mananthavady Road, Mysuru",GM,AI-Artificial Intelligence & Machine Learning,2,37414;65094,37414,min_closing_rank,"Multiple rows found"
2024,All Rounds,E145,"Vemana Institute of Technology-Koramangala, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,93201;91553,91553,min_closing_rank,"Multiple rows found"
2024,All Rounds,E145,"Vemana Institute of Technology-Koramangala, Bengaluru",GM,BD-Bachelor of Design,2,99387;94091,94091,min_closing_rank,"Multiple rows found"
2024,All Rounds,E147,"Vidyavardhaka College of Engineering-Gokulam, Mysuru",GM,AI-Artificial Intelligence & Machine Learning,2,97220;97489,97220,min_closing_rank,"Multiple rows found"
2024,All Rounds,E147,"Vidyavardhaka College of Engineering-Gokulam, Mysuru",GM,BD-Bachelor of Design,2,80021;94717,80021,min_closing_rank,"Multiple rows found"
2024,All Rounds,E147,"Vidyavardhaka College of Engineering-Gokulam, Mysuru",KKR,BD-Bachelor of Design,2,88448;96259,88448,min_closing_rank,"Multiple rows found"
2025,Round 4,E147,"Vidyavardhaka College of Engineering-Gokulam, Mysuru",GM,AD-Artificial Intelligence & Data Science,2,80591;106778,80591,min_closing_rank,"Multiple rows found"
2024,All Rounds,E152,"ATME College of Engineering-Bannur Road, Mysuru",GM,BD-Bachelor of Design,2,98996;91913,91913,min_closing_rank,"Multiple rows found"
2024,All Rounds,E156,"Jyothy Institute of Technology-Tathguni, Bengaluru",GM,BD-Bachelor of Design,2,95998;93842,93842,min_closing_rank,"Multiple rows found"
2025,Round 4,E161,"Cambridge Institute of Technology North Campus-Kundana, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,78588;77553,77553,min_closing_rank,"Multiple rows found"
2024,All Rounds,E164,"Reva University-Yelahanka, Bengaluru",GM,AI-Artificial Intelligence & Machine Learning,2,30418;28194,28194,min_closing_rank,"Multiple rows found"
2025,Round 4,E164,"Reva University-Yelahanka, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,61900;44001,44001,min_closing_rank,"Multiple rows found"
2025,Round 4,E164,"Reva University-Yelahanka, Bengaluru",GM,AE- Aeronautical Engineering,3,71315;100240;93248,71315,min_closing_rank,"Multiple rows found"
2024,All Rounds,E165,"Alliance College of Engineering and Design. Alliance University-Anekal, Bengaluru",GM,AS-Aerospace Engineering,2,36027;28364,28364,min_closing_rank,"Multiple rows found"
2024,All Rounds,E165,"Alliance College of Engineering and Design. Alliance University-Anekal, Bengaluru",GM,AU-Automobile Engineering,2,66463;55092,55092,min_closing_rank,"Multiple rows found"
2025,Round 4,E165,"Alliance College of Engineering and Design. Alliance University-Anekal, Bengaluru",GM,AR- Automation & Robotics Engineering,2,48973;106533,48973,min_closing_rank,"Multiple rows found"
2024,All Rounds,E171,"GITAM Deemed to be University-Dodaballapur taluk, Bengaluru",GM,BD-Bachelor of Design,2,37486;23197,23197,min_closing_rank,"Multiple rows found"
2025,Round 4,E171,"GITAM Deemed to be University-Dodaballapur taluk, Bengaluru",GM,AD-Artificial Intelligence & Data Science,4,38125;32484;99933;86220,32484,min_closing_rank,"Multiple rows found"
2025,Round 4,E173,"Presidency University-Yelahanka, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,108990;108926,108926,min_closing_rank,"Multiple rows found"
2025,Round 4,E173,"Presidency University-Yelahanka, Bengaluru",GM,AR- Automation & Robotics Engineering,2,107590;82366,82366,min_closing_rank,"Multiple rows found"
2025,Round 4,E173,"Presidency University-Yelahanka, Bengaluru",GM,AS-Aerospace Engineering,2,68743;51906,51906,min_closing_rank,"Multiple rows found"
2024,All Rounds,E187,"CMR University-Bagalur-Chagalatti, Bengaluru",GM,BD-Bachelor of Design,2,33330;94704,33330,min_closing_rank,"Multiple rows found"
2025,Round 4,E187,"CMR University-Bagalur-Chagalatti, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,103021;109536,103021,min_closing_rank,"Multiple rows found"
2024,All Rounds,E198,"R V Institute of Technology and Management-J P Nagar, Bengaluru",GM,BD-Bachelor of Design,2,14477;19948,14477,min_closing_rank,"Multiple rows found"
2024,All Rounds,E198,"R V Institute of Technology and Management-J P Nagar, Bengaluru",KKR,BD-Bachelor of Design,2,21713;29521,21713,min_closing_rank,"Multiple rows found"
2025,Round 4,E198,"R V Institute of Technology and Management-J P Nagar, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,24673;21189,21189,min_closing_rank,"Multiple rows found"
2024,All Rounds,E207,"BGS College of Engineering and Technology- Mahalaxmipuram, Bengaluru",GM,BD-Bachelor of Design,2,90968;99748,90968,min_closing_rank,"Multiple rows found"
2025,Round 4,E207,"BGS College of Engineering and Technology-Mahalaxmipuram, Bengaluru",GM,AD-Artificial Intelligence & Data Science,2,106934;90133,90133,min_closing_rank,"Multiple rows found"
`;

function parseLine(line: string) {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const lines = rawBlock1.split('\n').filter((l) => l.trim().length > 0);
  let inserted = 0;
  let updated = 0;

  for (const line of lines) {
    const cols = parseLine(line);
    if (cols.length < 9) continue;

    const year = Number(cols[0]);
    const roundStr = cols[1];
    const round = roundStr.includes('4') ? 4 : roundStr.includes('3') ? 3 : roundStr.includes('2') ? 2 : 1;
    const collegeId = cols[2];
    const category = cols[4];
    const rawCourse = cols[5];
    const closingRank = Number(cols[8]);

    // Extract course ID e.g. "AI-Artificial Intelligence & Machine Learning" -> "AI"
    const courseId = rawCourse.includes('-') ? rawCourse.split('-')[0].trim() : rawCourse;
    const courseName = rawCourse.includes('-') ? rawCourse.split('-').slice(1).join('-').trim() : rawCourse;

    const key = {
      collegeId,
      courseId,
      examCode: 'COMEDK',
      year,
      round,
      category,
    };

    const doc = {
      ...key,
      courseName,
      branch: courseName,
      closingRank,
      source: 'official_pdf_import',
      verifiedBy: 'system_admin',
      lastUpdated: new Date(),
    };

    const res = await CutoffModel.updateOne(key, { $set: doc }, { upsert: true });
    if (res.upsertedCount > 0) inserted++;
    else updated++;
  }

  console.log(`Seeding Block 1 finished: ${inserted} inserted, ${updated} updated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
