//Modules and all
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
var natural = require('natural');
natural.PorterStemmer.attach();
var fs = require('fs');

const port = process.env.PORT || 3000;
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// Delarations
  let keyWordsAll = [];
  let tf_idf = [];
  let problemStatement = [];
  let problemLinksArray = [];
  let problemTitlesArray = [];
  let tf_idf_mod = [];

// extract problemLinksArray - from clicktype/cfproblemlinks.txt - links array storing all links of the problems in order
function makeLinksArray(clicktype){
  return new Promise(function(resolve, reject) {
    let myReadstream = fs.createReadStream('public/'+clicktype+'/cfproblem_links.txt', 'utf8');
    myReadstream.on('data', function(chunk){
      // Replacing \n or \r\n or \r by a space
      let problemLinks=chunk.replace(/(\r\n|\n|\r)/gm, " ");
      let problemLinksChunkArray = problemLinks.split(" ");
      for (let str in problemLinksChunkArray) {
        problemLinksArray.push(problemLinksChunkArray[str]);
      }
    });
    myReadstream.on('end', ()=>{
      resolve();
    });
  });
}
// extract problemTitlesArray - from clicktype/cfproblemtitles.txt - problem Titles array storing problem titles in order
function makeTitlesArray(clicktype){
  return new Promise(function(resolve, reject){
    let myReadstream = fs.createReadStream('public/'+clicktype+'/cfproblem_titles.txt', 'utf8');
    myReadstream.on('data', function(chunk){
      // Removing \r tags(seen in codechef problems) before splitting by \n
      let problemTitles=chunk.replace(/(\r)/gm, "");;
      let problemTitlesChunkArray = problemTitles.split("\n");
      for (let str in problemTitlesChunkArray) {
        problemTitlesArray.push(problemTitlesChunkArray[str]);
      }
    });
    myReadstream.on('end', ()=>{
      resolve();
    });
  });
}
// extract problemStatement - from clicktype/problem_statement_all.txt - paragraph to be displayed of problems
function makeProblemStatement(clicktype){
  return new Promise(function(resolve, reject) {
    let myReadstream = fs.createReadStream('public/'+clicktype+'/problem_statement_all.txt', 'utf8');
    myReadstream.on('data', function(chunk){
      let problemStatementStringArray = chunk.split('\n');
      for(i in problemStatementStringArray){
        problemStatement.push(problemStatementStringArray[i]);
      }
    });
    myReadstream.on('end',()=>{
      resolve();
    });
  });
}
// extract keyWordsAll - from clicktype/keywordsall.txt - all keyWords in corpus
function makeKeywordsAll(clicktype){
  return new Promise(function(resolve, reject) {
    let myReadstream = fs.createReadStream('public/'+clicktype+'/keywordsall.txt', 'utf8');
    myReadstream.on('data', function(chunk){
      let keywords=chunk;
      let keywordsChunkArray = keywords.split(" ");
      for (let str in keywordsChunkArray) {
        keyWordsAll.push(keywordsChunkArray[str]);
      }
    });
    myReadstream.on('end', ()=>{
      resolve();
    });
  });
}
// extract tf_idf - from clicktype/tf_idf/(i).txt - tfidf from txt files using file stream
function makeTfidf(filelocation, i){
  return new Promise(function(resolve, reject) {
    tf_idf[i] =[];
    // initialisation to zero
    for(let l = 0; l<keyWordsAll.length; l++){
      tf_idf[i].push(0);
    }
    let myReadstream = fs.createReadStream(filelocation, 'utf8');
    myReadstream.on('data',function(chunk){
      let tf_idf_array_string = chunk.split('\n');
      for (let j = 0; j<tf_idf_array_string.length;j++){
        // splitting tf_idf (j, tf_idf) to j and its tf_idf
        let arr = tf_idf_array_string[j].split(' ');
        let k = Number(arr[0]);
        let val = Number(arr[1])
        // update non zero values
        tf_idf[i][k]= val;
      }
    });
    myReadstream.on('end',()=>{
      resolve();
    });
  });
}
// extract tf_idf_mod - from clicktype/tf_idf_mod.txt - precomputed mod of tf_idf arrays
function makeTfidfMod(clicktype){
  return new Promise(function(resolve, reject) {
    let myReadstream = fs.createReadStream('public/'+clicktype+'/tf_idf_mod.txt', 'utf8');
    myReadstream.on('data', function(chunk){
      let modValues = chunk.split('\n');
      for(i in modValues){
        tf_idf_mod.push(Number(modValues[i]));
      }
    });
    myReadstream.on('end',()=>{
      resolve();
    });
  });
}


// Functions for query by user
function getKeyWordsArray(data){
  // Filtering only English letters ignoring rest all
  let stringWithoutLineBreaks = data.replace(/[^a-zA-Z ]/g, "");
  // Adding space to two squeezed words : RedBlue -- Red Blue
  stringWithoutLineBreaks = stringWithoutLineBreaks.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Removing Extra spaces
  stringWithoutLineBreaks = stringWithoutLineBreaks.replace(/\s+/g,' ').trim();
  // Everything to lowercase
  stringWithoutLineBreaks = stringWithoutLineBreaks.toLowerCase();
  // Using Natural to remove stopwords and stemming
  return stringWithoutLineBreaks.tokenizeAndStem();
}

function getFrequencyMap(array){
  let arrayMap = new Map();
  for(let i = 0; i<array.length; i++){
    if(!isNaN(arrayMap[array[i]])){
      if(arrayMap[array[i]]){
        arrayMap[array[i]]++;
      }
      else{
        arrayMap[array[i]]=1;
      }
    }
    else{
      arrayMap[array[i]]=1;
    }
  }
  return arrayMap;
}

function modOfVector(vector){
  var mod = 0;
  for (let i = 0; i<vector.length; i++){
    mod += (vector[i]*vector[i]);
  }
  return Math.sqrt(mod);
}

function tf_idf_for_post(map){
  let tf_idf_query = [];
  for (let k =0; k<keyWordsAll.length;k++) {
    let foo = map[keyWordsAll[k]]
    if(!isNaN(foo)){
      if(foo){
          let termFrequencyKeyWord = foo/(keyWordsAll.length);
          tf_idf_query.push(termFrequencyKeyWord);
      }
      else{
        tf_idf_query.push(0);
      }
    }
    else{
      tf_idf_query.push(0);
    }
  }
  return tf_idf_query;
}

// Cosine Similarity Function
function cosine_similarity(query_tf_idf){
  let map_results = new Map();
  let mod_query = modOfVector(query_tf_idf);
  for (let i = 0; i<tf_idf.length; i++){
    //tf_idf[i]
    let mod_tf_idf_element = tf_idf_mod[i];
    // Dot Product
    let dot_product = 0;
    for (let j = 0; j<query_tf_idf.length; j++){
      dot_product += (query_tf_idf[j]*(tf_idf[i])[j]);
    }
    let modproduct = mod_query*mod_tf_idf_element;
    let cosine_value;
    if(modproduct!=0){
      cosine_value = dot_product/(modproduct);
    }
    else{
      cosine_value = 0;
    }
    map_results.set(cosine_value, i);
  }
  // sorting map_results by cosine_value
  map_results = new Map([...map_results.entries()].sort((a, b) => b[0] - a[0]));
  return map_results;
}

// extraction
async function extraction(clicktype){
  // reset everything to erase earlier clicktype data for each clicktype
  problemLinksArray = [];
  problemTitlesArray = [];
  keyWordsAll = [];
  tf_idf = [];
  tf_idf_mod = [];
  problemStatement = [];

  // extraction begins
  await makeLinksArray(clicktype);
  await makeTitlesArray(clicktype);
  await makeKeywordsAll(clicktype);
  for(let i =0; i<problemTitlesArray.length; i++){
    let filelocation = 'public/'+clicktype+'/tf_idf/'+(i+1)+'.txt'
    await makeTfidf(filelocation,i);
    cnt =0;
  }
  await makeTfidfMod(clicktype);
  await makeProblemStatement(clicktype);
  // extraction ends
}

app.get("/", function(req,res){
  res.sendFile(__dirname+"/index.html");
});

app.post("/", function(request, response){
  async function run(clicktype){
    await extraction(clicktype);
    let query_keywords = getKeyWordsArray(queryString);
    let query_string_map = getFrequencyMap(query_keywords);
    let query_tf_idf = tf_idf_for_post(query_string_map);
    let query_cosine_similarity = cosine_similarity(query_tf_idf);
    // things to be printed as results
    let queryResultsLinks = [];
    let queryResultsTitles = [];
    let queryResultsProblemStatement = [];
    // save results into them
    for (let [key, value] of query_cosine_similarity) {
      let index = value;
      queryResultsTitles.push(problemTitlesArray[index]);
      queryResultsLinks.push(problemLinksArray[index]);
      queryResultsProblemStatement.push(problemStatement[index]);
    }
    // no of queries to be printed
    if(queryResultsLinks.length>=10)l=queryResultsLinks.length;
    else l = queryResultsLinks.length;
    //Passing results to .ejs file
    response.render("results", {queryString: queryString,queryResultsLinks: queryResultsLinks, queryResultsTitles: queryResultsTitles, l:l, queryResultsProblemStatement: queryResultsProblemStatement, btn:btn});
  }
  let queryString ='';
  let s = '';
  let btn;
  if(request.body.codeChef){
    s = 'codechef_only_query';
    run(s);
    queryString = request.body.codeChef;
    btn = 1;
  }
  else if(request.body.codeforces){
    s = 'codeforces_only_query';
    run(s);
    queryString = request.body.codeforces;
    btn = 2;
  }
  else if(request.body.all){
    queryString = request.body.all;
    s = 'all_search_query';
    run(s);
    btn = 0;
  }
  else{
    queryString = request.body.query;
    btn = 0;
    s = 'all_search_query';
    run(s);
  }
});

app.listen(port, function(){
  console.log("Server Started at 3000");
});