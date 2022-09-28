function* asyncFunction(...args) {
  try {
    const text = yield readFile(
      path.join(__dirname, "custom_promise.js"),
      "utf8"
    );
    console.log(`${text.length} characters read`);
    const newText = yield delay(2000, text.replace(/[aeiou]/g, ""));
    console.log(newText.slice(0, 200));
  } catch (error) {
    console.log("An error occurred!");
    console.log(error);
  } finally {
    console.log("---All done!---");
  }
}

const isNotThenable = obj => !obj || typeof obj !== 'function';

function genRunner(generator, ...args) {
  let gen = generator(args);

  return (function handleYieldedValue(lastValue) {
    let yieldedValue = gen.next(lastValue);

    if (yieldedValue.done) {
      return Promise.resolve(yieldedValue.value);
    } else {
      Promise.resolve(yieldedValue.value)
        .then((value) => handleYieldedValue(value))
        .catch((reason) => gen.throw(reason));
    }
  })();
}

genRunner(asyncFunction);
