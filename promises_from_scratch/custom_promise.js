/* eslint-disable max-lines-per-function */
const STATES = {
  PENDING: "pending",
  FULFILLED: "fulfilled",
  REJECTED: "rejected",
};

class CustomPromise {
  #thenQueue = [];
  #finallyQueue = [];

  constructor(resolver) {
    if (typeof resolver !== "function") {
      throw TypeError(`Promise resolver ${resolver} is not a function`);
    }

    this.state = STATES.PENDING;
    this.value = undefined;
    this.reason = undefined;

    resolver(this.resolve.bind(this), this.reject.bind(this));
  }

  static resolve(value) {
    return new CustomPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new CustomPromise((_, reject) => reject(reason));
  }

  // eslint-disable-next-line max-lines-per-function
  static all(promises) {
    // eslint-disable-next-line max-lines-per-function
    return new CustomPromise((resolve, reject) => {
      try {
        if (promises.length === 0) resolve([]);

        let result = [];
        let fulfilledPromises = 0;
        promises.forEach((promise, index) => {
          if (!CustomPromise.#isThenable(promise)) {
            promise = CustomPromise.resolve(promise);
          }

          promise
            .then((value) => {
              fulfilledPromises += 1;
              result[index] = value;

              if (promises.length === fulfilledPromises) {
                resolve(result);
              }
            })
            .catch(reject);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  static allSettled(promises) {
    // eslint-disable-next-line max-lines-per-function
    return new CustomPromise((resolve) => {
      if (promises.length === 0) resolve([]);

      let result = [];
      let resolvedPromises = 0;

      promises.forEach((promise, index) => {
        if (!CustomPromise.#isThenable(promise)) {
          promise = CustomPromise.resolve(promise);
        }

        promise
          .then((value) => {
            result[index] = { status: STATES.FULFILLED, value };
          })
          .catch((reason) => {
            result[index] = { status: STATES.REJECTED, reason };
          })
          .finally(() => {
            resolvedPromises += 1;
            if (promises.length === resolvedPromises) {
              resolve(result);
            }
          });
      });
    });
  }

  static race(promises) {
    return new CustomPromise((resolve, reject) => {
      promises.forEach((promise) => {
        if (!CustomPromise.#isThenable(promise)) resolve(promise);

        promise.then(resolve).catch(reject);
      });
    });
  }

  static any(promises) {
    return new CustomPromise((resolve, reject) => {
      if (promises.length === 0) reject(new AggregateError(), "Empty iterable");
      let rejectedPromises = 0;
      let rejectedValues = [];

      promises.forEach((promise) => {
        promise.then(resolve).catch((reason, index) => {
          rejectedPromises += 1;
          rejectedValues[index] = reason;

          if (rejectedPromises === promises.length) {
            reject(
              new AggregateError(rejectedValues),
              "All promises were rejected"
            );
          }
        });
      });
    });
  }

  static #isThenable(obj) {
    return obj && typeof obj.then === "function";
  }

  then(onFulfilled, onRejected) {
    const returnedPromise = new CustomPromise(() => {});

    this.#thenQueue.push([returnedPromise, onFulfilled, onRejected]);

    if (this.#isFulfilled()) {
      this.executeWithEmptyStack(this.propagateFulfilled.bind(this));
    }
    if (this.#isRejected()) {
      this.executeWithEmptyStack(this.propagateRejected.bind(this));
    }

    return returnedPromise;
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onResolved) {
    const returnedPromise = new CustomPromise(() => {});

    this.#finallyQueue.push([returnedPromise, onResolved]);

    if (this.#isResolved()) {
      this.executeWithEmptyStack(this.propagateResolved.bind(this));
    }

    return returnedPromise;
  }

  propagateResolved() {
    for (let [returnedPromise, onResolved] of this.#finallyQueue) {
      try {
        onResolved();

        if (this.#isFulfilled()) {
          returnedPromise.resolve(this.value);
        } else {
          returnedPromise.reject(this.reason);
        }
      } catch (error) {
        returnedPromise.reject(error);
      }
    }

    this.#finallyQueue = [];
  }

  resolve(value) {
    if (this.#isResolved()) {
      return;
    }

    this.state = STATES.FULFILLED;
    this.value = value;

    this.executeWithEmptyStack(this.propagateFulfilled.bind(this));
    this.executeWithEmptyStack(this.propagateResolved.bind(this));
  }

  propagateFulfilled() {
    for (let [returnedPromise, onFulfilled] of this.#thenQueue) {
      try {
        if (typeof onFulfilled === "function") {
          this.resolvePromise(returnedPromise, onFulfilled(this.value));
        } else {
          returnedPromise.resolve(this.value);
        }
      } catch (error) {
        returnedPromise.reject(error);
      }
    }

    this.#thenQueue = [];
  }

  resolvePromise(returnedPromise, returnedValue) {
    if (returnedPromise === returnedValue) {
      returnedPromise.reject(new TypeError());
    }

    if (CustomPromise.#isThenable(returnedValue)) {
      returnedValue.then(
        (value) => returnedPromise.resolve(value),
        (reason) => returnedPromise.reject(reason)
      );
    } else {
      returnedPromise.resolve(returnedValue);
    }
  }

  reject(reason) {
    if (this.#isResolved()) {
      return;
    }

    this.state = STATES.REJECTED;
    this.reason = reason;

    this.executeWithEmptyStack(this.propagateRejected.bind(this));
    this.executeWithEmptyStack(this.propagateResolved.bind(this));
  }

  propagateRejected() {
    for (let [returnedPromise, , onRejected] of this.#thenQueue) {
      try {
        if (typeof onRejected === "function") {
          this.resolvePromise(returnedPromise, onRejected(this.reason));
        } else {
          returnedPromise.reject(this.reason);
        }
      } catch (error) {
        returnedPromise.reject(error);
      }
    }

    this.#thenQueue = [];
  }

  executeWithEmptyStack(fn) {
    setTimeout(fn);
  }

  #isResolved() {
    return this.#isFulfilled() || this.#isRejected();
  }

  #isFulfilled() {
    return this.state === STATES.FULFILLED;
  }

  #isRejected() {
    return this.state === STATES.REJECTED;
  }
}

const fs = require("fs");
const path = require("path");

const readFile = (filename, encoding) =>
  new CustomPromise((resolve, reject) => {
    fs.readFile(filename, encoding, (err, value) => {
      if (err) {
        return reject(err);
      }

      resolve(value);
    });
  });

const delay = (timeInMs, value) =>
  new CustomPromise((resolve) => {
    setTimeout(resolve, timeInMs, value);
  });

readFile(path.join(__dirname, "custom_promise.js"), "utf8")
  .then((text) => {
    console.log(`${text.length} characters read`);
    return delay(2000, text.replace(/[aeiou]/g, ""));
  })
  .then((newText) => {
    console.log(newText.slice(0, 200));
  })
  .catch((err) => {
    console.error("An error occurred");
    console.error(err);
  })
  .finally(() => console.log("All done!"));
