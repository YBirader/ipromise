Implement Promise/A+

constructor:
input: callback
output: new promise

- promise has one one three mutually exclusive states i.e. pending (default), fulfilled, rejected.
- promise has a value (default undefined)
- promise has a reason (default undefined)
- state is immutable if promise is fulfilled or rejected
- if type of callback is not a function, throw TypeError
- callback is called with two args i.e. resolve and reject
- if callback throw error, catch error and return rejected promise with reason = error

then method:
input: onFulfilled, onRejected
output: new promise

- append 

resolve method:
input: value
output: void

- if calling promise is resolved, return
- if calling promise pending, change state to fulfilled and value = value
- run onfulfilled handlers of then