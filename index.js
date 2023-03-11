require('dotenv').config()
const puppeteer = require('puppeteer');

(async () => {
    const browser = await initBrowser()
    const page = await goToPage(browser)

    await page.exposeFunction('log', log)
    await page.exposeFunction('sleep', sleep)
    await page.exposeFunction('getBalance', getBalance)

    await login(page)
    await sleep(4000)

    await page
        .waitForSelector('#qa_trading_totalInvestment')
        .then(() => log('got it'));

    await page.evaluate(observer)

    page.on("pageerror", function (err) {
        theTempValue = err.toString()
        console.log("Page error: " + theTempValue)
    })

    page.on("error", function (err) {
        theTempValue = err.toString();
        console.log("Error: " + theTempValue);
    })
})();

const sleep = ms => new Promise(res => setTimeout(res, ms))

const log = text => console.log(text)

const getBalance = async context => {
    const selector = '#qa_trading_balance'
    const balance = await document.querySelector(selector)
    return Number(balance.textContent.replace(/[^0-9-]+/g, "")) / 100;
}

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

    const logLossAttempt = (newResult, actualValue, balanceDiff) => {
        let msg =
            newDate() +
            ' \033[31m LOSS!!!  \x1b[37m {result: ' +
            newResult.toUpperCase() +
            ', value: ' +
            actualValue +
            ', balanceDiff: ' +
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balanceDiff) +
            '}'
        log(msg)
    }

    const logWinAttempt = (newResult, actualValue, balanceDiff) => {
        let msg =
            newDate() +
            ' \x1b[32m WIN!!!  \x1b[37m  {result: ' +
            newResult.toUpperCase() +
            ', value: ' +
            actualValue +
            ', balanceDiff: ' +
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balanceDiff) +
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
        const selector = '#amount-counter > div > div > div > vui-input-number > div > div:nth-child(1)'
        await context.document.querySelector(selector).click()
    }

    const downAttemptValue = async context => {
        const selector = '#amount-counter > div > div > div > vui-input-number > div > div:nth-child(2) > vui-icon'
        await context.document.querySelector(selector).click()
    }

    const getLabelValue = async context => {
        const selector = '#qa_trading_totalInvestment'
        const totalInvestment = await document.querySelector(selector)
        return Number(totalInvestment.textContent.replace(/[^0-9.-]+/g, "")) / 100;
    }

    const openResultPanel = async context => {
        const selector = '#qa_historyButton > div'
        const panel = await document.querySelector(selector)
        panel.click()
    }

    const closePopup1 = async context => {
        const selector = 'body > binomo-root > lib-platform-scroll > div > div > jarvis > ' +
            'div > ng-component > vui-new-toast > div > div > button'
        const popupCloseButton = await document.querySelector(selector)
        popupCloseButton.click()
    }

    const closePopup2 = async context => {
        const selector = 'body > binomo-root > lib-platform-scroll > div > div > jarvis > ' +
            'div > ng-component > vui-new-toast > div > div > button'
        const popupCloseButton = await document.querySelector(selector)
        popupCloseButton.click()
    }

    const closePopup3 = async context => {
        const selector = 'body > ng-component > vui-modal > div > div > button'
        const popupCloseButton = await document.querySelector(selector)
        popupCloseButton.click()
    }

    const getLastResult = async context => {
        const selector = '#qa_trading_tradeHistoryStandardTab > option-item:nth-child(1) > div > div.inner > div.result > p'
        const result = await document.querySelector(selector)
        return Number(result.textContent.replace(/[^0-9.-]+/g, ""));
    }

    var firstLoop = true;
    var loss = false;
    var totalAttempts = 0
    var lossSequenceCount = 0
    var lastAttempt = 'green'
    var lastAttemptValue = 0
    var isAgainAttemptLoss = false

    var clearLossConfig = false
    var goalWinValue = 12
    var limitLossValue = 8
    var initialBalance = 0

    const observer = new MutationObserver(async mutations => {
        if (firstLoop) {
            await sleep(300)
            initialBalance = await getBalance(this) + 5
            await sleep(1000)
            await openResultPanel(this)
            await sleep(100)
        }

        await sleep(1000)
        let labelValue = await getLabelValue(this)

        if (isAgainAttemptLoss && labelValue > 1) {
            return
        }

        await sleep(500)
        lastAttemptValue = await getValueInput(this);
        await sleep(200)

        if (labelValue !== 0 && lastAttemptValue === labelValue) {
            firstLoop = false
            return;
        }

        await sleep(500)

        if (lastAttemptValue > await getLastResult(this)) {
            loss = true
        } else {
            loss = false
        }

        await sleep(500)

        let balanceDiff = await getBalance(this) - initialBalance

        if (balanceDiff >= 100) {
            log('WIN!!! \o/')
            return
        }

        if (!firstLoop && !loss) {
            isAgainAttemptLoss = false
            lossSequenceCount = 0
            logWinAttempt(lastAttempt, await getValueInput(this), balanceDiff)
            log('')
            loss = false
            let count = 8
            while (count > 1) {
                await sleep(200)
                await downAttemptValue(this)
                count--
            }

            if ((balanceDiff) >= goalWinValue) {
                initialBalance = await getBalance(this)
                // log('WAITING 30min')
                // await sleep(18000)
                log('WIN! GOAL WAITING 10min')
                let minutos = 10
                await sleep(minutos * 60 * 1000)
                log('')
            }

            await sleep(200)
            lastAttempt = await execAttempt(this, lastAttempt, loss)
            // lastAttempt = await execAttempt(this, lastAttempt, Math.floor(Math.random() * 2))
            await sleep(200)
            totalAttempts++
            lastAttemptValue = await getValueInput(this);
            logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
            await sleep(200)
        }

        if (!firstLoop && loss) {
            let result = lastAttempt === 'green' ? 'red' : 'green'
            lossSequenceCount++
            logLossAttempt(result, await getValueInput(this), balanceDiff)
            log('')

            if ((balanceDiff * -1) >= limitLossValue) {
                let count = 8
                while (count > 1) {
                    await sleep(200)
                    await downAttemptValue(this)
                    count--
                }
                initialBalance = await getBalance(this)
                lossSequenceCount = 0

                // log('WAITING 30min')
                // await sleep(18000)
                log('FAIL! GOAL WAITING 10min')
                let minutos = 10
                await sleep(minutos * 60 * 1000)
                log('')
            }

            // await sleep(200)
            // totalAttempts++
            // lastAttempt = await execAttempt(this, lastAttempt, true)
            // await sleep(200)
            // lastAttemptValue = await getValueInput(this);
            // await sleep(200)
            // logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
            // await sleep(200)

            clearLossConfig = lossSequenceCount > 1

            if (clearLossConfig) {
                log('REACHED THE LIMIT LOSS')
                log('')
                let count = 8
                while (count > 1) {
                    await sleep(200)
                    await downAttemptValue(this)
                    count--
                }
                clearLossConfig = false
                lossSequenceCount = 0
            }

            await sleep(500)

            if (lossSequenceCount < 1) {
                await sleep(200)
                totalAttempts++
                lastAttempt = await execAttempt(this, lastAttempt, true)
                // lastAttempt = await execAttempt(this, lastAttempt, Math.floor(Math.random() * 2))
                await sleep(200)
                lastAttemptValue = await getValueInput(this);
                await sleep(200)
                logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
                await sleep(200)
            }

            if (lossSequenceCount === 1) {
                isAgainAttemptLoss = true
                let count = 2
                let toggleFirst = true
                totalAttempts++

                while (count > 0) {
                    await sleep(200)
                    lastAttempt = await execAttempt(this, lastAttempt, toggleFirst)
                    toggleFirst = false
                    await sleep(200)
                    lastAttemptValue = await getValueInput(this);
                    await sleep(200)
                    logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
                    count--
                }
            }

            if (lossSequenceCount === 2) {
                isAgainAttemptLoss = true
                let count = 4
                let toggleFirst = true
                totalAttempts++

                while (count > 0) {
                    await sleep(200)
                    lastAttempt = await execAttempt(this, lastAttempt, toggleFirst)
                    toggleFirst = false
                    await sleep(200)
                    lastAttemptValue = await getValueInput(this);
                    await sleep(200)
                    logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
                    count--
                }
            }

            if (lossSequenceCount > 2) {
                await upAttemptValue(this)
                await sleep(200)
                totalAttempts++
                lastAttempt = await execAttempt(this, lastAttempt, true)
                await sleep(200)
                lastAttemptValue = await getValueInput(this);
                await sleep(200)
                logAttemptAction(totalAttempts, lastAttempt, lastAttemptValue)
                await sleep(200)
            }
        }
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
        args: [`--window-size=${1920},${1080}`, '--disable-features=site-per-process']
    })
}