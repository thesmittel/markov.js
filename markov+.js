const nbt = require("nbt-js");
const { Namespace } = require("socket.io");

//PRIVATE METHODS TO PREVENT USER MESSING THINGS UP 
function getRanges(word, words, contextsize) {
  //failsave: if no data exist for the last i characters, reduce the context size by 1 until it works.
  //changes behaviour drastically and isnt pretty in these cases, but it gives longer results
  for (var i = 0; i < contextsize; i++) {
    if (words.w[word] == undefined) {
      word = word.substring(1);
    }
  }

  if (word.length == 0) {
    //return null if nothing is found
    return null;
  } else {
    //Get the total amount of characters following the word. (Sum of all probabilities for each valid character)
    var total = words.w[word]["t"];

    //failsave
    if (total == undefined) total = 1;

    //get the map of all characters following a word and the amount of occurences
    var followup = words.w[word].f;
    var nw = word;



    //get the characters that follow the word
    var ranges = [];
    var keys = Object.keys(words.w[word].f);
    var totalrange = 0;

    //calculate the probabilities
    for (var x in keys) {
      ranges[x] = [keys[x], totalrange + (parseFloat(followup[keys[x]]) / parseFloat(total))];
      totalrange += (parseFloat(followup[keys[x]]) / parseFloat(total));
    }
    return ranges;
  }
}

function getWordRanges(word, model, context) {
  if (model.w[word] != undefined) {
    var followup = model.w[word].f
    var ranges = []
    var totalrange = 0
    var keys = Object.keys(model.w[word].f);
    // console.log(keys);
    for (x in keys) {
      // console.log(keys[x]);
      ranges[x] = [keys[x], totalrange + (parseFloat(followup[keys[x]]) / parseFloat(model.w[word].t))];
      totalrange += (parseFloat(followup[keys[x]]) / parseFloat(model.w[word].t));
    }
    return ranges
  } else {
    return null
  }

}

function randomInt(max) {
  return Math.floor(Math.random() * max)
}

function randomProperty(object) {
  //returns a random key
  var keys = Object.keys(object);
  return keys[randomInt(keys.length)];
}

function getElement(key) {
  //"Search" function
  return this.model.w[key];
}

function getRandom(ranges) {
  //stop if getRanges returns null
  if (ranges == null) return null;

  //get a weighted random entry from the ranges generated in getRanges
  var rand = Math.random();
  for (var x in ranges) {
    if (rand < ranges[x][1]) return ranges[x][0];
  }
}

function newSum(objectToSum) {
  var sum = 0;
  for (var x in objectToSum) {
    sum += parseInt(objectToSum[x]);
  }
  return sum
}

const compareArrays = (a, b) => {
  return a.toString() === b.toString();
}

function intToByteArray(num) {
  num = Math.floor(num);
  let res = [];
  while (num > 0) {
    let y = num % 256;
    res.push(y);
    num -= y;
    num /= 256;
  }
  return res
}

function processAndExtractMainGroup(buffer) {
  buffer.shift();

  let lastBytes = [-1,-1,-1];
  const target = [0,0,0];

  for (let b in buffer) {
    lastBytes.push(buffer[b])
    lastBytes.shift()
    
    
    if (compareArrays(lastBytes, target)) {
      // console.log("reached end of main", b);
      buffer.splice(b + 1);
      res = grabDatapoints(buffer)
      return res;
    }
    
  }
}

function grabDatapoints(buffer) {
  
  const target = [0,0];
  let lastBytes = [-1, -1]
  
  let tempArr = [];
  let datapoints = [];


  for (let i in buffer) {
    lastBytes.push(buffer[i]);
    lastBytes.shift();
    tempArr.push(buffer[i]);

    if(compareArrays(target, lastBytes)) {
      datapoints.push(tempArr);
      tempArr = [];
      continue;
    }

  }
  let dp = {}
  for (let x of datapoints) {
    let el = parseDatapoint(x);
    if (el !== null) dp[el.name] = {"t": el.t, "f": el.f}
    
  }

  
  return(dp)
}

function parseDatapoint (buffer) {
  const asciify = (a) => {return String.fromCharCode(a)};
  let rest = buffer.splice(buffer.indexOf(0));
  let name = buffer;

  const decoder = new TextDecoder();

  // PROCESS NAME
  name.shift();
  let nameT = name.splice(name.indexOf(3))
  let nameStr = "";
  nameStr = decoder.decode(new Uint8Array(name).buffer)
  
  nameT.shift();
  let nameAmt = 0;
  for (let i in nameT) {
    nameAmt += (Math.pow(256, i) * nameT[i])
  }
  if (nameStr == "") return null;

  // PROCESS REST
  rest.shift();
  rest.pop();
  let tmpRest = [];

  let f = {};

  for (let i of rest) {
    if (i == 0) {
      tmpRest.shift();
      let tmpAmt = tmpRest.splice(tmpRest.indexOf(3));
      let nameArr = new Uint8Array(tmpRest).buffer;
      let tmpName = decoder.decode(nameArr);
      tmpRest = [];
      //console.log("TMP AMT", tmpAmt)
      tmpAmt.shift();
      let amount = 0;
      for (let i in tmpAmt) {
        amount += (Math.pow(256, i) * tmpAmt[i])
      }
      f[tmpName] = amount;
      continue;
    }
    tmpRest.push(i);
  }

  return {"name": nameStr, "t": nameAmt, "f": f}
}

//everything beyond this point is WIP and so far unused
function invertWeights(rangeObject) {
  for (x in rangeObject.f) {
    rangeObject.f[x] = rangeObject.t - rangeObject.f[x];
  }
  return rangeObject;
}

//BEGIN OF MODULE
module.exports = class Markov {
  /*Read:
    WIP. Some functions are unused, those are marked as such.
  */


  fs = require("fs");
  model = {};

  constructor() {
    this.model = { "w": {} };
  }


  learn(arr, l_context) {
    if (typeof l_context !== "number") throw TypeError(`Markov.learn expects learn(string, number), got learn(${typeof arr}, ${typeof l_context})`);
    if (typeof arr === "string" && this.model.wordbased === true) throw Error("Cant train word based models with letter based input");
    if (typeof arr === "object" && this.model.wordbased === false) throw Error("Can't train letter based models with word based input");
    this.model.wordbased = (typeof arr === "object")

    // console.log(l_context, this.model.wordbased);
    //x in arr: Either loop through for every character in string or every word in array of words
    //Only supports character based learning at this point
    for (var x = 0; x < arr.length - 1; x++) {
      //get next character/word
      var w2 = arr[parseInt(x) + 1];

      var str = "";
      //get the previous characters/words depending on specified context size
      if (this.model.wordbased) {
        for (var y = l_context - 1; y >= 0; y--) {
          str += ((arr[parseInt(x) - y] == undefined ? "" : arr[parseInt(x) - y]) + " ");
        }
        str = str.trim();
      } else {
        for (var y = l_context - 1; y >= 0; y--) {
          str += (arr[parseInt(x) - y] == undefined ? "" : arr[parseInt(x) - y]);
        }
      }

      // console.log(this.model.w[str])    
      if (this.model.w[str] === undefined) {
        //if context doesnt exist add datapoint
        this.model.w[str] = { "t": 1, "f": { [w2]: 1 } };
      } else {
        //add new data to word
        this.model.w[str].t++;
        if (this.model.w[str].f == undefined) this.model.w[str].f = {}
        if (this.model.w[str].f[w2] == undefined) this.model.w[str].f[w2] = 0;
        this.model.w[str].f[w2]++;
      }

    }
  }

  save(filepath) {
    if (!filepath) throw TypeError(`Markov.save expects save(string), got save(${typeof filepath})`);
    
    const encoder = new TextEncoder();

    let temp = []
    temp.push(1);

    if (this.model.w.wordbased){
      // wordbased model
    } else {
      temp.push(14, 25, 29);
      for (let w in this.model.w) {
        temp.push(2) //start of string
        temp.push(...(encoder.encode(w))) // The string
        temp.push(3); //end of string
        temp.push(...intToByteArray(this.model.w[w].t)) // total number of occurences
        temp.push(0)
        for (let f in this.model.w[w].f) {
          temp.push(2, f.charCodeAt(0), 3, ...intToByteArray(this.model.w[w].f[f]), 0)
        }
        temp.push(0) // end of datapoint (double 0)
      }
      temp.push(0) // end of group
      temp.push(29, 4); // End of file (leaving room for easily implementable additional sections)
                        // should there some day be more or different data that should be stored,
                        // it can be appended between 25 and 4 to maintain backwards compatibility
                        // (excess data will simply be ignored)
    }
    console.log(temp.length)
    console.log(JSON.stringify(this.model).length)
    let file = new Buffer.from(temp)

    
    console.log(file)
    this.fs.writeFileSync(filepath, file, function() {})
    
   // this.fs.writeFileSync(filepath, JSON.stringify(this.model), function () { });
  }

  load(filepath) {
    if (!filepath) throw TypeError(`Markov.load expects load(string), got load(${typeof filepath})`);
    // this.model = JSON.parse(this.fs.readFileSync(filepath).toString());
    this.reset();

    let temp = Array.from(this.fs.readFileSync(filepath));
    console.log(`loaded ${temp.length} bytes`)
    this.model.wordbased = temp[1]==15;



    if (this.model.wordbased) {

    } else {
        this.model.w = processAndExtractMainGroup(temp.splice(temp.indexOf(29)));
    }
    console.log("Done!")
  }

  reset() {
    this.model = { "w": {} };
  }




  generate(length, l_context, startstring, endflag) {
    if (typeof length !== "number" || typeof l_context !== "number") throw TypeError(`Markov.generate expexts generate(number, number), got generate(${typeof length}, ${typeof l_context})`)
    //get random word to start generating
    var start = startstring || randomProperty(this.model.w);
    var output = this.model.wordbased ? start.split(" ") : start;
    if (!start) throw Error("Cannot generate text with empty models");
    if (this.model.wordbased) {
      //Loop for word based generation
      if (output.join(" ").length > length) return output
      for (var i = output.length; i < length; i++) {
        let add = null;
        let context = l_context;
        while (add == null && context > 0) {
          var check = ""
          for (var x = l_context; x >= 0; x--) {
            check += (output[output.length - x] || "") + " ";
          }
          check = check.trim()
          add = getRandom(getWordRanges(check, this.model, l_context))
          context--;
        }

        if (add == null) return output
        output[output.length] = add

        if (endflag != undefined && output.endsWith(endflag) && output != endflag) return output;
      }

    } else {
      //loop for letter based generation
      for (var i = start.length; i < length; i++) {
        var add = getRandom(getRanges(output.substr(-l_context), this.model, l_context));
        if (add == undefined) {
          // if no data exist for word, stop generating
          return output || "Not enough data!";
        } else {
          // else add new character to output
          output = output + add;
        }
        if (endflag != undefined && output.endsWith(endflag) && output != endflag) return output;
      }

    }


    if (!output) throw new Error("No output data", this, 82)
    return output || "Not enough data!";
  }

  stringify(inputArray) {
    if (typeof inputArray !== "object") throw Error("Method stringify expected an array");
    var output = "";
    for (var w in inputArray) {
      output += `${inputArray[w]} `
    }
    return output;
  }



  search(searchString) {
    return this.model.w[searchString];
  }

  forget(forgetString, contextSize, instances) {
    let temp = { "w": {} }
    instances = instances || 1
    //Go through normal learning (get string and char) 
    for (var x = 0; x < forgetString.length - 1; x++) {
      var str = "";
      for (var y = contextSize - 1; y >= 0; y--) {
        str += (forgetString[parseInt(x) - y] == undefined ? "" : forgetString[parseInt(x) - y]);
      }
      var w2 = forgetString[parseInt(x) + 1];

      //Check if learned word exists
      if (this.model.w[str]) {
        if (this.model.w[str].f[w2]) {
          //Reduce weights by amount given
          this.model.w[str].f[w2] -= instances;
          //delete if weight is smaller than 0
          if (this.model.w[str].f[w2] <= 0) delete this.model.w[str].f[w2];
        }
        this.model.w[str].t = this.newSum(this.model.w[str].f);
      }
    }
    //Delete all words with no data
    for (var modelentries in this.model.w) {
      if (Object.keys(this.model.w[modelentries].f).length === 0) delete this.model.w[modelentries];
    }
  }
  replace(origString, replString) {
    return 0;
  }

  merge(mergeModel) {
    //Merge this.model with given model
    if (mergeModel.model.wordbased != this.model.wordbased) throw Error("Can't merge letter based models with word based models!");
    if (mergeModel.model.w == undefined) throw Error("Can't merge empty model");
    for (var x in mergeModel.model.w) {
      if (this.model.w[x] == undefined) {
        this.model.w[x] = mergeModel.model.w[x];
      } else {
        this.model.w[x].t += mergeModel.model.w[x].t;
        for (var y in mergeModel.model.w[x].f) {
          if (this.model.w[x].f[x] == undefined) {
            this.model.w[x].f[y] = mergeModel.model.w[x].f[y];
          } else {
            this.model.w[x].f[y] += mergeModel.model.w[x].f[y];
          }
        }
      }
    }
  }

}