require('dotenv').config()
const puppeteer = require('puppeteer');

(async () => {
    const browser = await initBrowser()
    const page = await goToPage(browser)

    await page.exposeFunction('log', log)
    await page.exposeFunction('sleep', sleep)

    await login(page)
    await sleep(4000)

    await page
        .waitForSelector('#qa_trading_totalInvestment')
        .then(() => log('got it'));

    await page.evaluate(observer)
})();

const sleep = ms => new Promise(res => setTimeout(res, ms))
const log = text => console.log(text)

async function observer() {
    const newDate = () => {
        let date = new Date()
        let hours = date.getHours()
        let minutes = date.getMinutes()
        let seconds = date.getSeconds()
        let amPm = hours >= 12 ? 'pm' : 'am'
        hours = hours % 12
        hours = hours ? hours : 12 // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes
        var strTime = hours + ':' + minutes + ':' + seconds + ' ' + amPm
        return (
          '[' +
          date.getDate() +
          '/' +
          (date.getMonth() + 1) +
          '/' +
          date.getFullYear() +
          ' ' +
          strTime +
          ']'
        )
      }

      const logAttemptAction = (totalAttempts, lastAttempt, actualValue) => {
        let msg =
          newDate() +
          ' \x1b[34m Start \x1b[37m attempt {quantity: ' +
          totalAttempts +
          ', color: ' +
          lastAttempt.toUpperCase() +
          ', value: ' +
          actualValue +
          '}'
        log(msg)
      }

      const logLossAttempt = (newResult, actualValue) => {
        let msg =
          newDate() +
          ' \033[31m LOSS!!!  \x1b[37m {result: ' +
          newResult.toUpperCase() +
          ', value: ' +
          actualValue +
          '}'
        log(msg)
      }
  
      const logWinAttempt = (newResult, actualValue) => {
        let msg =
          newDate() +
          ' \x1b[32m WIN!!!  \x1b[37m  {result: ' +
          newResult.toUpperCase() +
          ', value: ' +
          actualValue +
          '}'
        log(msg)
      }

    const setValueInput = async (context, value) => {
        const selector = '#amount-counter input[type=text]';
        await context.document.querySelector(selector).value(value)
    }

    const getValueInput = async (context) => {
        let selector = '#amount-counter input[type=text]';
        return await Number(context.document.querySelector(selector).value)
    }

    const execAttempt = async (context, lastAttempt, toggle) => {
        let selector = lastAttempt === 'green'
            ? '#qa_trading_dealUpButton > button'
            : '#qa_trading_dealDownButton > button'
        let attemptColor = lastAttempt === 'green' ? 'green' : 'red'
        if (toggle) {
            attemptColor = lastAttempt === 'green' ? 'red' : 'green'
            selector = lastAttempt === 'green'
            ? '#qa_trading_dealDownButton > button'
            : '#qa_trading_dealUpButton > button'
        }
        await context.document
            .querySelector(selector)
            .click()
        return attemptColor
    }

    const upAttemptValue = async context => {
        const selector = '#amount-counter > ' +
            'div.input_input-group__39TBc > ' +
            'div.input_input-helper__17cT2 > vui-input-number > ' +
            'div > div:nth-child(1) > vui-icon > i'
        await context.document.querySelector(selector).click()
    }

    const downAttemptValue = async context => {
        const selector = '#amount-counter > ' +
            'div.input_input-group__39TBc > div.input_input-helper__17cT2 ' +
            '> vui-input-number > div > div:nth-child(2) > vui-icon > i'
        await context.document.querySelector(selector).click()
    }

    const getLabelValue = async context => {
        const selector = '#qa_trading_totalInvestment';
        const totalInvestment = await document.querySelector(selector)
        return Number(totalInvestment.textContent.replace(/[^0-9.-]+/g, "")) / 100;
    }

    const getBalance = async context => {
        const selector = '#qa_trading_balance';
        const totalInvestment = await document.querySelector(selector)
        return Number(totalInvestment.textContent.replace(/[^0-9.-]+/g, ""));
    }

    var firstLoop = true;
    var loss = false;
    var totalAttempts = 0
    var lastAttempt = 'green'
    var lastAttemptValue = 0
    var oldBalance = 0
    var limitLoss = 80
    var breakLimitLoss = false

    const observer = new MutationObserver(async mutations => {
        await sleep(500)
        let labelValue = await getLabelValue(this)

        await sleep(500)
        lastAttemptValue = await getValueInput(this);
        await sleep(200)
        log('lastAttemptValue: ' + lastAttemptValue + ', labelValue: ' + labelValue);

        if (labelValue !== 0 && lastAttemptValue === labelValue) {
            firstLoop = false
            return;
        }

        await sleep(2000)
        
        if (oldBalance > await getBalance(this)) {
            loss = true
        } else {
            loss = false
        }

        await sleep(500)

        if (!firstLoop && !loss) {
            log('win')
            logWinAttempt(lastAttempt, await getValueInput(this))
            loss = false
            let count = 8
            while (count > 1) {
                await sleep(300)
                await downAttemptValue(this)
                count--
            }
            await sleep(2000)
            oldBalance = await getBalance(this)
            await sleep(1000)
            lastAttempt = await execAttempt(this, lastAttempt, loss)
            await sleep(1000)
            totalAttempts++
            lastAttemptValue = await getValueInput(this);
            logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
            await sleep(1000)
        }

        breakLimitLoss = await getValueInput(this) >= limitLoss;

        if (!firstLoop && loss && breakLimitLoss) {
            log('REACHED THE LIMIT LOSS')
            let count = 8
            while (count > 1) {
                await sleep(300)
                await downAttemptValue(this)
                count--
            }
            breakLimitLoss = false
        }

        if (!firstLoop && loss) {
            log('loss')
            let result = lastAttempt === 'green' ? 'red' : 'green'
            logLossAttempt(result, await getValueInput(this))
            await sleep(2000)
            await upAttemptValue(this)
            oldBalance = await getBalance(this)
            await sleep(500)
            lastAttempt = await execAttempt(this, lastAttempt, loss)
            totalAttempts++
            await sleep(1000)
            lastAttemptValue = await getValueInput(this);
            await sleep(1000)
            logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
            await sleep(1000)
        }
        log('final_loop')
    })

    await sleep(1000)

    const selector = '#qa_trading_totalInvestment';
    let totalInvestment = await document.querySelector(selector)

    observer.observe(totalInvestment, {
        childList: true,
        characterData: true,
        attributes: true,
        subtree: true,
    })

    if (firstLoop) {
        log('firstLoop')
        log('')
        log(newDate() + ' INIT')
        log('')
        await sleep(1000)
        oldBalance = await getBalance(this)
        lastAttempt = await execAttempt(this, lastAttempt, loss)
        totalAttempts++
        lastAttemptValue = await getValueInput(this);
        logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
        await sleep(1000)
    }
}

async function login(page) {
    await sleep(1500)
    await page.type(
        'vui-input-text > input[type=text]',
        process.env.BINOMO_USER
    )
    await page.type(
        'vui-input-password > input[type=password]',
        process.env.BINOMO_PASSWORD
    )
    await sleep(500)
    await page.click('#qa_auth_LoginBtn > button')
}

async function goToPage(browser) {
    const url = process.env.BINOMO_URL
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)
    await page.goto(url)
    return page
}

async function initBrowser() {
    return await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        ignoreHTTPSErrors: true,
        args: [`--window-size=${1920},${1080}`]
    })
}