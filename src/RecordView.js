//-----------------------------------------------------------------------
// recordView.js
//        Array와 Map을 적당히 이용해서 만든 2차원 배열.
//        sorting, filtering등이 용이하도록 만들엇다.
// creator : andy
// date    : 2021-01-12
// update history
//           2021-04-15 : RecordView.outerJoin() 추가
//           2021-04-13 : RecordView.select() 추가
//                        RecordFields.size, length 추가
//-----------------------------------------------------------------------
'use strict';
// 3 const eventEmitter = require('events');

// RecodView.fields.size 를 쓰기 위해서 이다.
// 원래는 length로 참조하면 되지만... 
// RecordView.size 라는 getter가 있기 때문에
// 사용상의 편의를 위하여 추가함
if (!Array.prototype.size) {
  Array.prototype.size = function () { return this.length };
}

// 내부적으로만 사용함
class RecordFields {
  keys = new Map();
  constructor(aryFields) {
    for (let index = 0; index < aryFields.length; index++) {
      this.keys.set(aryFields[index], index);
    }
  };
  get size() { return Object.getOwnPropertyNames(this.keys).length; };
  get length() { return this.size };
};

//-----------------------------------------------------------------------
// Row data 의 마지막에는 2개의 컬럼이 자동으로 추가된다.
// 2개는 internal-index, filter-flag이다.
class RecordView { //} extends eventEmitter {
  constructor(aryFields, aryRecordData) {
    //super();
    // private property (외부 참조 금지)
    this.m_aryField = aryFields;
    this.m_bNowFiltering = false;
    this.m_haFilterIndex = new Map(); // 필터링 중에는 이걸로 참조
    this.m_aryDatas = [];  // 실제 데이터(row)의 모음
    this.m_haFields = new RecordFields(aryFields).keys;  // field를 이름으로 참조할때 사용하기 위해서..

    this.$m_lastSortMenthod = null; // 마지막으로 어떤 방식으로 소팅했는가. ..?
    // 생성시 받아온 데이터가 있으면..
    if (aryRecordData != undefined && aryRecordData.length > 0)
      for (let index = 0; index < aryRecordData.length; index++) {
        this.append(aryRecordData[index]);
      }

    // RecordView[3]과 같이 참조하기 위해서 추가됨
    return new Proxy(this, {
      get: (obj, key) => {
        if (typeof (key) === 'string' && (Number.isInteger(Number(key)))) // key is an index
          if (parseInt(key) < this.size) {
            if (this.m_bNowFiltering == false)
              return obj.m_aryDatas[key]; // 객체 뒤에 [숫자] 를 붙이는 참조
            else
              return obj.m_aryDatas[this.m_haFilterIndex.get(key)];
          } else {
            throw 'KeyNotFoundException: Key ' + key + ' not found';
          }
        else
          return obj[key]     // 객체뒤에 . 을 붙이는 참조 (객체 method나 member variable 참조)
      },
      set: (obj, key, value) => {
        //throw '직접 제어 지원하지 않음';
        if (typeof (key) === 'string' && (Number.isInteger(Number(key)))) {// key is an index
          throw 'Fobidden Access'; //'Row data 자체를 엑세스 하는 것은 금지';
          /* if (this.m_bNowFiltering == false)
             obj.m_aryDatas[key] = value;  // 객체 뒤에 [숫자] 를 붙이는 참조
           else
             obj.m_aryDatas[this.m_haFilterIndex.get(key)] = value;
             */
        } else
          obj[key] = value        // 객체뒤에 . 을 붙이는 참조 (객체 method나 member variable 참조)
        return true;
      }
    });
  };

  // fileds는 Array이다.
  get fields() { return this.m_aryField };

  //-----------------------------------------------------------------------
  // row number는 필터링 중이냐 아니냐에 따라서 계산식이 다름
  get size() {
    if (this.m_bNowFiltering)
      return this.m_haFilterIndex.size;
    else
      return this.m_aryDatas.length;
  };
  get length() {
    if (this.m_bNowFiltering)
      return this.m_haFilterIndex.size;
    else
      return this.m_aryDatas.length;
  };

  //-----------------------------------------------------------------------
  // 한 행의 데이터를 추가한다..
  append(recordData) {
    // 컬럼 수가 모자라면 무조건 undefined 로 추가한다. 
    // 남으면 그냥 잘라 버린다고 생각하면 된다.
    if (recordData.length != this.m_aryField.length) {
      for (let index = recordData.length; index < this.m_aryField.length + 2; index++) {
        recordData.push(undefined);
      }
      recordData[this.m_aryField.length] = this.m_aryDatas.length;
      recordData[this.m_aryField.length + 1] = true;
    } else {
      recordData.push(this.m_aryDatas.length); // sort를 초기화 할떄 사용하는 숫자이다.
      recordData.push(true);                  // filter 상황을 저장하기 위한 내역
    }
    // recordData[2] 와 같이 참조하기 위하여 만듬... 그런데 Array는 원래 제공하는데
    // recordData['fild-name'] 와 같이 참조 때문에 확장함
    recordData = new Proxy(recordData, {
      get: (obj, key) => {
        if (key === '_ary_origin__data_') return obj;  // 그냥 원본 데이터를 받으려고 할때.. 내부적으로만 사용되긴 하는데...음..
        else if (typeof (key) === 'string' && (Number.isInteger(Number(key))))  // key is an index
          if (parseInt(key) < this.m_haFields.size + 2) {
            return obj[key];
          } else {
            throw 'KeyNotFoundException: Key ' + key + ' not found';
          }
        else
          return obj[this.m_haFields.get(key)];
      },
      set: (obj, key, value) => {
        if (typeof (key) === 'string' && (Number.isInteger(Number(key)))) // key is an index
          obj[key] = value;
        else
          obj[this.m_haFields.get(key)] = value;
        return true;
      }
    });
    this.m_aryDatas.push(recordData);
  };

  //-----------------------------------------------------------------------
  // index에서 시작해서 length 만큼 삭제 
  // length는 안주면 1로 자동 설정
  remove(index, length = 1) { this.m_aryDatas.splice(index, length) };

  //-----------------------------------------------------------------------
  // 모든 데이터 삭제 
  deleteAll() { this.m_aryDatas.clear() };

  //-----------------------------------------------------------------------
  // sort
  // 파라미터를 안주면 초기 상태(즉 추가된 순서)로 정렬됨
  sort(callback = undefined) {
    if (callback != undefined && callback != null) {
      this.$m_lastSortMenthod = callback;
      this.m_aryDatas.sort(callback);
    } else {
      this.$m_lastSortMenthod = (a, b) => { return a[this.m_aryField.length] - b[this.m_aryField.length] };
      this.m_aryDatas.sort(this.$m_lastSortMenthod);
    }
  };
  get lastSortingMethod() { return this.$m_lastSortMenthod };

  //-----------------------------------------------------------------------
  // select
  // 원본 리스트를 그대로 두고 새로운 객체를 생성한다.
  // 다만 새로운 객체의 데이터를 수정하면 원본 데이터도 수정됨
  select(callback = undefined) {
    if (callback != undefined && callback != null) {
      let tmpAry = [];
      for (let index = 0; index < this.m_aryDatas.length; index++) {
        const element = this.m_aryDatas[index];
        let show = callback(element);
        if (show) {
          tmpAry.push(element._ary_origin__data_);
          // let newRD = [];
          // for (let index = 0; index < this.fields.length; index++) {
          //   const oneVal = element[index];
          //   newRD.push(oneVal);
          // }
          // tmpAry.push(newRD);
        }
      }
      return new RecordView(this.fields, tmpAry);
    } else
      return new RecordView(this.fields, []);
  };

  //-----------------------------------------------------------------------
  // filter
  // 파라미터를 안주면 필터링이 초기화됨
  filter(callback = undefined) {
    this.m_bNowFiltering = false;
    this.m_dFilteringSize = 0;
    this.m_haFilterIndex.clear();

    if (callback != undefined && callback != null) {
      this.m_bNowFiltering = true;
      let showCount = 0;
      for (let index = 0; index < this.m_aryDatas.length; index++) {
        const element = this.m_aryDatas[index];
        let show = callback(element);
        element[this.m_aryField.length + 1] = show;
        if (show) {
          this.m_haFilterIndex.set(`${showCount}`, index);
          //console.log(showCount, '->', index);
          showCount++;
        }
      }
    }
  };

  // async 방식으로 fillt
  asyncFilter(callback = undefined) {
    let self = this;
    console.log('prev async');
    //    return new Promise(function (resolve, reject) {
    return new Promise((resolve, reject) => {
      for (let index = 0; index < 100000; index++) {
        self.filter(callback);
      }
      console.log('all done');
      //setTimeout(function () {
      resolve();
      // }, (5) * 1000);
      //      resolve();
    });
  }

  //-----------------------------------------------------------------------
  // base.key += append.key 라는 형태의 OuterJoin 구현
  // 새로 생성되는 객체는 원본과 전혀 별개임
  // 즉.. 새로운 객체의 데이터를 수정해도 원본은 그대로 유지됨
  outerJoin(outer, key, appendFields) {
    // 기존에 sort한 내용이 있으면 기억해 두기 위해서 이다.
    let baseSort = this.lastSortingMethod;
    let outerSort = outer.lastSortingMethod;
    let tmpAry = [];
    let newFlds = this.fields.concat(appendFields);
    // 일단 정렬을 해 놓고
    this.sort((a, b) => { return ('' + a[key]).localeCompare(b[key]); });
    outer.sort((a, b) => { return ('' + a[key]).localeCompare(b[key]); });
    let subIndex = 0;
    for (let index = 0; index < this.length; index++) {
      const rd = this[index];
      const newRd = [];
      // 일단 기존것을 복사해 두고...
      for (let j = 0; j < this.fields.length; j++) {
        newRd.push(rd[j]);
      }
      //let loopFlag = true;
      while (true) {
        if (subIndex >= outer.length) {
          break;
        }
        //console.log(rd[key]);
        //console.log(outer[subIndex][key]);
        //console.log(('' + rd[key]).localeCompare(outer[subIndex][key]));
        if (rd[key] === outer[subIndex][key]) {
          // console.log('1111');
          for (let j = 0; j < appendFields.length; j++) {
          //  if (appendFields[j] === key)
          //    continue
            newRd.push(outer[subIndex][appendFields[j]]);
            subIndex++;
            //break;
          }
          //tmpAry.push(newRd);
        } else if (('' + rd[key]).localeCompare(outer[subIndex][key]) < 0) {
          break;
        } else {
          subIndex++;
        }
      }
      tmpAry.push(newRd);
    }
    return new RecordView(newFlds, tmpAry);
    //base.sort()

  }

  //-----------------------------------------------------------------------
  // 콘솔 창에 데이터를 쉽게 보기 위하여 만들었다.
  // 개발용 함수 정도로 생각해야지.. 사용자에게 먼가 보여줄려고 쓰기에는;;;;
  // maxLine은 화면에 출력하는 최대 Row 수 이다.
  // 이 이상은 출력하지 않는다. -1인 경우에는 전체 데이터를 출력한다.
  viewDatas(maxLine = 20) {
    maxLine = Math.min(maxLine, this.size);
    if (maxLine == -1) maxLine = this.size;
    // 화면 출력에 필요한 크기를 찾는다.
    let maxLength = 9; // undefined의 글자수가 9임
    for (let index = 0; index < this.m_aryField.length; index++) {
      maxLength = Math.max(maxLength, this.m_aryField[index].length);
    }
    let rowNum = 0;
    for (let i = 0; i < this.m_aryDatas.size; i++) {
      const element = this.m_aryDatas[i];
      if (this.m_bNowFiltering && element[this.m_aryField.length + 1] == false) continue;
      for (let j = 0; j < this.m_aryField.length; j++) {
        maxLength = Math.max(maxLength, `${element[j]}`.length);
      }
      rowNum++;
      if (rowNum >= maxLine) break;
    }
    maxLength += 2; // 최대 표시 컬럼 글자 보다 공백을 두기 위해서 2개 추가

    let cap = '+-------+';
    let fldNames = '|  IDX  | ';
    for (let index = 0; index < this.m_aryField.length; index++) {
      fldNames = fldNames + this.m_aryField[index].padEnd(maxLength) + '| ';
      cap = cap + '-'.padEnd(maxLength + 1, '-') + '+';
    }
    console.log(cap);
    console.log(fldNames);
    console.log(cap);
    rowNum = 0;
    for (let i = 0; i < this.m_aryDatas.length; i++) {
      const element = this.m_aryDatas[i];
      if (this.m_bNowFiltering && element[this.m_aryField.length + 1] == false) continue;
      let buf = '| ' + rowNum.toString().padEnd(5) + ' | ';
      for (let j = 0; j < this.m_aryField.length; j++) {
        buf = buf + `${element[j]}`.padEnd(maxLength) + '| ';
      }
      console.log(buf);
      rowNum++;
      if (rowNum >= maxLine) break;
    }
    console.log(cap);
    console.log('');
  }

} // end of RecordView

async function main() {
  let rv = new RecordView(['field1', 'field2'], [[1.12, 2], [3, 4], [5, 6]])
  // 접근 방법
  rv[0]['field1'] = 11.223;  // 접근 횟수가 적을때 추천
  rv[0][0] = 22.333          // 접근은 이 방법이 더 빠름 (접근이 많은 경우 추천)
  //  console.log(rv[0]['field1']);
  //  console.log(rv.fields[1]);

  // 추가 하는 방법
  let recordData = [7, 8, 9]; // 필드보다 데이터가 많으면 무시됨
  rv.append(recordData);
  rv.append([9, 0]);
  rv.append([9]);    // 필드 보다 데이터가 적으면 undefined로 설정됨
  // 삭제 하는 방법
  rv.remove(1, 2);  // 또는 rv.remove(1);

  console.log("Initualized data "); rv.viewDatas();  // 현재 데이터 출력

  // 정렬 예제
  rv.sort((a, b) => {
    return (parseFloat(a['field2']) || 0.0) - (parseFloat(b['field2']) || 0.0);
//    return a['field2'] - b['field2']
  });
  console.log("After field2 Sort"); rv.viewDatas();

  rv.sort(); // clear sort
  console.log("After Clear Sort"); rv.viewDatas();

  // select 예제..
  const newRV = rv.select(rd => { if (rd['field2'] <= 2 || rd['field2'] == undefined) return true; else return false; });
  console.log('Select field2 <= 2  Filter'); newRV.viewDatas();

  // 필터링 예제
  rv.filter((rd) => {
    if (rd['field2'] <= 2 || rd['field2'] == undefined)
      return true;
    else
      return false;
  });
  console.log('After field2 <= 2  Filter'); rv.viewDatas();

  rv.filter();
  console.log('After clear Filter'); rv.viewDatas();

  console.log('Prev Async Filter');
  rv.asyncFilter((rd) => {
    if (rd['field2'] <= 2 || rd['field2'] == undefined)
      return true;
    else
      return false;
  });
  console.log('After Async Filter');
  rv.viewDatas();

  // 아래 2행은 접근 방법이 같은 걸 보여준다.
  console.log(rv[1]['field1']);
  console.log(rv[1][0]);

  // 순회 예제
  for (let r = 0; r < rv.size; r++) {
    let row = rv[r];
    for (let c = 0; c < rv.fields.size; c++) {
      //console.log(rv[r][c]);
      console.log(row[c]);
    }
  }
  //setInterval(() => { }, 1000);

  // outer join 예제
  let base = new RecordView(['name', 'field2', 'field3'], [['AAA', 1.12, 2], ['BBB', 3, 4], ['CCC', 5, 6]]);
  console.log('+-------------------------------------------------+');
  console.log('|-----------  Outer Join Example -----------------|');
  console.log('+-------------------------------------------------+');
  console.log('Base');
  base.viewDatas();
  let outer = new RecordView(['name', 'field5', 'field6'], [['DDD', '1-1', '1-2'], ['BBB', '2-1', '2-2'], ['CC', '3-1', '3-2']]);
  console.log('Outer');
  outer.viewDatas();

  let joinedRV = base.outerJoin(outer, 'name', ['field5', 'field6']);
  console.log('Outer Join Result : base.name += outer.name');
  joinedRV.viewDatas();
};

// 테스트용 코드
 //main();
//module.exports = {
//  RecordView
//};

//export { RecordView };
