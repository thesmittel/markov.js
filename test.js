// import Markov from binarymarkov;
let Markov;
import("binarymarkov").then(module => {
    Markov = module;
    main();
    
});

function main() {
    console.log(Markov)
    const m = new Markov.Markov();
    // m.learn("testing purposes meant to test stuff and oo, why is this so hard to verify i dont get it".split(" "), 2)
    // m.learn("testing purposes meant to test stuff and oo, why is this so hard to verify i dont get it".split(" "), 1)
    // m.description = "A testing module";
    // m.author = "Smittel";
    // m.year = 2023;
    // m.save("./testing.bin")
    m.load("./testing.bin")
}