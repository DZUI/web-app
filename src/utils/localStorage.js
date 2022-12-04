// 存储数据
export const setLocalStorage = (key, value) => {
    // 将数组、对象类型的数据转换为 JSON 格式字符串进行存储
    let needVal;

    if (typeof value === 'object') {
        needVal = JSON.stringify(value);
    } else {
        needVal = value;
    }

    window.localStorage.setItem(key, needVal);
};

// 获取数据
export const getLocalStorage = key => {
    const data = window.localStorage.getItem(key);

    try {
        return JSON.parse(data);
    } catch (err) {
        return data;
    }
};

// 删除数据
export const removeLocalStorage = key => {
    window.localStorage.removeItem(key);
};
