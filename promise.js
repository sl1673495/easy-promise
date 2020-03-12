const PENDING = 'pending'
const RESOLVED = 'resolved'
const REJECTED = 'rejected'

// 首先我们创建了三个常量用于表示状态，对于经常使用的一些值都应该通过常量来管理，便于开发及后期维护
// 在函数体内部首先创建了常量 that，因为代码可能会异步执行，用于获取正确的 this 对象
// 一开始 Promise 的状态应该是 pending
// value 变量用于保存 resolve 或者 reject 中传入的值
// resolvedCallbacks 和 rejectedCallbacks 用于保存 then 中的回调，因为当执行完 Promise 时状态可能还是等待中，这时候应该把 then 中的回调保存起来用于状态改变时使用
// 接下来我们来完善 resolve 和 reject 函数，添加在 MyPromise 函数体内部
function EasyPromise(fn) {
  const that = this
  that.state = PENDING
  that.value = null
  that.resolvedCallbacks = []
  that.rejectedCallbacks = []

  // 执行传入的函数并且将之前两个函数当做参数传进去
  // 要注意的是，可能执行函数过程中会遇到错误，需要捕获错误并且执行 reject 函数
  try {
    fn(resolve, reject)
  } catch (e) {
    reject(e)
  }

  function resolve(value) {
    if (value instanceof EasyPromise) {
      return value.then(resolve, reject)
    }

    nextTick(() => {
      if (that.state === PENDING) {
        that.state = RESOLVED
        that.value = value
        that.resolvedCallbacks.map(cb => cb(that.value))
      }
    })
  }

  function reject(value) {
    nextTick(() => {
      if (that.state === PENDING) {
        that.state = REJECTED
        that.value = value
        that.rejectedCallbacks.map(cb => cb(that.value))
      }
    })
  }
}

EasyPromise.prototype.then = function (onFulfilled, onRejected) {
  onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v
  onRejected = typeof onFulfilled === 'function' ? onRejected : e => { throw e }

  const that = this
  let promise2
  if (this.state === PENDING) {
    // 首先我们返回了一个新的 Promise 对象，并在 Promise 中传入了一个函数
    // 函数的基本逻辑还是和之前一样，往回调数组中 push 函数
    // 同样，在执行函数的过程中可能会遇到错误，所以使用了 try...catch 包裹
    // 规范规定，执行 onFulfilled 或者 onRejected 函数时会返回一个 x，并且执行 Promise 解决过程，
    // 这是为了不同的 Promise 都可以兼容使用，比如 JQuery 的 Promise 能兼容 ES6 的 Promise
    return (promise2 = new EasyPromise((resolve, reject) => {
      that.resolvedCallbacks.push(() => {
        try {
          // 在这个时候 that.value已经有值了 
          // 因为上一个promise已经被resolve过了
          const x = onFulfilled(that.value)
          resolutionProcedure(promise2, x, resolve, reject)
        } catch (e) {
          reject(e)
        }
      })

      that.rejectedCallbacks.push(() => {
        try {
          const x = onRejected(that.value)
          resolutionProcedure(promise2, x, resolve, reject)
        } catch (r) {
          reject(r)
        }
      })
    }))
  }

  if (that.state === RESOLVED) {
    return (promise2 = new MyPromise((resolve, reject) => {
      nextTick(() => {
        try {
          const x = onFulfilled(that.value)
          resolutionProcedure(promise2, x, resolve, reject)
        } catch (reason) {
          reject(reason)
        }
      })
    }))
  }

  if (that.state === REJECTED) {
    return (promise2 = new MyPromise((resolve, reject) => {
      nextTick(() => {
        try {
          const x = onRejected(that.value)
          resolutionProcedure(promise2, x, resolve, reject)
        } catch (reason) {
          reject(reason)
        }
      })
    }))
  }
}

// 实现兼容多种 Promise 的 resolutionProcedure 函数
function resolutionProcedure(promise2, x, resolve, reject) {
  if (promise2 === x) {
    return reject(new TypeError('Error'))
  }

  if (x instanceof EasyPromise) {
    x.then(function (value) {
      resolutionProcedure(promise2, value, resolve, reject)
    }, reject)
  }

  // 首先创建一个变量 called 用于判断是否已经调用过函数
  // 然后判断 x 是否为对象或者函数，如果都不是的话，将 x 传入 resolve 中
  // 如果 x 是对象或者函数的话，先把 x.then 赋值给 then，然后判断 then 的类型，如果不是函数类型的话，就将 x 传入 resolve 中
  // 如果 then 是函数类型的话，就将 x 作为函数的作用域 this 调用之，
  // 并且传递两个回调函数作为参数，第一个参数叫做 resolvePromise ，
  // 第二个参数叫做 rejectPromise，两个回调函数都需要判断是否已经执行过函数，然后进行相应的逻辑
  // 以上代码在执行的过程中如果抛错了，将错误传入 reject 函数中

  let called = false
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    try {
      const then = x.then
      if (typeof then === 'function') {
        then.call(
          x,
          y => {
            if (called) return
            called = true
            resolutionProcedure(promise2, y, resolve, reject)
          },
          e => {
            if (called) return
            called = true
            reject(e)
          }
        )
      } else {
        resolve(x)
      }
    } catch (e) {
      if (called) return
      called = true
      reject(e)
    }
  }else {
    resolve(x)
  }
}

function nextTick(fn) {
  setTimeout(fn, 0);
}