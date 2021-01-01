# gamecomp.js
Copyright 2018-2021 Adam Nielsen <<malvineous@shikadi.net>>  

This is a Javascript library that can pass data through different algorithms
used by MS-DOS games from the 1990s.  Typically this is used to compress and
decompress game data, as well as encrypt and decrypt it too.

## Installation as an end-user

If you wish to use the command-line `gamecomp` utility to work with the
algorithms directly, you can install the library globally on your system:

    npm install -g @camoto/gamecomp

### Command line interface

The `gamecomp` utility can be used to apply and reverse algorithms on data.
Data to process is supplied on `stdin` and the processed data is sent to
`stdout`.  Use the `--help` option to get a list of all the available options.
Some quick examples:

    # List supported algorithms and their options
    gamecomp --formats

    # Compress a file using LZW with some custom options
    gamecomp +cmp-lzw cwEOF=256 cwFirst=257 < clear.txt > out.lzw

    # Decrypt a file with an XOR cipher using the default options
    gamecomp -enc-xor-blood < crypt.bin > clear.bin

When specifying the algorithm in the first parameter, it is prefixed with a `+`
to apply the algorithm (compress/encrypt) or a `-` to reverse it
(decompress/decrypt).

## Installation as a dependency

If you wish to make use of the library in your own project, install it
in the usual way:

    npm install @camoto/gamecomp

See `cli/index.js` for example use.  The quick start is:

    const GameCompression = require('@camoto/gamecomp');
    
    // Decompress a file
    const cmpAlgo = GameCompression.getHandler('cmp-lzw');
    const input = fs.readFileSync('data.lzw');
    const output = cmpAlgo.reveal(content);
    fs.writeFileSync('data.raw', output);
    
    // Encrypt the file with custom options
    const crypto = GameCompression.getHandler('enc-xor-blood');
    const output = crypto.obscure(input, {
        seed: 123,
    });
    fs.writeFileSync('data.xor', output);

## Installation as a contributor

If you would like to help add more file formats to the library, great!
Clone the repo, and to get started:

    npm install --dev

Run the tests to make sure everything worked:

    npm run -s test

You're ready to go!  To add a new algorithm:

 1. Create a new file in the relevant subfolder for the algorithm type, such as
    `compress/` or `encrypt/`.

 2. Edit the main `index.js` and add a `require()` statement for your new file.

 3. Make a folder in `test/` for your new algorithm and populate it with
    files similar to the others.  The tests work by passing standard data to
    each algorithm and comparing the result to what is inside this folder.  Run
    the tests just for your new algorithm (instead of all of them) by passing
    the grep (`-g`) parameter to Mocha, the test framework.  This will run any
    test matching the given string:
    
        npm run -s test -- -g cmp-myformat
    
    Your tests will fail until you have created the expected sample files in
    the `tests/cmp-myformat/` folder.
    
    You can either create these files by hand, with another utility, or if you
    are confident that your code is correct, from the code itself.  This is done
    by setting an environment variable when running the tests, which will cause
    the data produced by your code to be saved to a temporary file in the
    current directory:
    
        SAVE_FAILED_TEST=1 npm run -s test -- -g cmp-myformat
        mv error1.bin test/cmp-myformat/default.bin

During development you can examine the output of your algorithm like this:

    # Decompress (remove algo/reveal data)
    $ DEBUG='gamecomp:cmp-myformat*' ./bin/gamecomp -cmp-myformat param=value < compressed.bin > clear.test

    # Compress (apply algo/obscure data)
    $ DEBUG='gamecomp:cmp-myformat*' ./bin/gamecomp +cmp-myformat param=value < clear.bin > compressed.test

If you use `debug()` rather than `console.log` then these messages can be left
in for future diagnosis as they will only appear when the `DEBUG` environment
variable is set appropriately.
