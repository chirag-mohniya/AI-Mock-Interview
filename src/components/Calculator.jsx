import { useState } from 'react';
import '../Css/calculator.css';

const today = new Date();
function formatDate(date){
    return new Intl.DateTimeFormat(
        'en-us',
        {weekday:'long'}
    ).format(date);
}

export function Calculator() {
  const [a,SetA] = useState(0);
  const [b,SetB] = useState(0);
  const [total,SetTotal] = useState(0);
  // const [subtract,SetSubtract] = useState(0);
  const [type,SetType]=useState("sum");

  const calculatedSum=()=>{
    
      switch(type){
      case "sum" :
        return SetTotal(a+b);
      case "subtract" : 
        return SetTotal(a-b);
      case "multiplication" : 
        return SetTotal(a*b);
      case "divide" : 
        return SetTotal(a/b);
    }
  
  }
  return (
    <div>
        <div className="Card">
          <h1>Calculator <br/> Today is {formatDate(today)}</h1>
          <input type="number" placeholder="Enter A" value={a} onChange={(e)=>SetA(Number(e.target.value))}/>
          <br />
          <input type="number" placeholder="Enter B" value={b} onChange={(e)=>SetB(Number(e.target.value))}/>
          <br />
          <label htmlFor="options">Choose Type</label>
          <select id="options" value={type} style={{color:'green '}} onChange={(e)=>SetType(String(e.target.value))}>
            <option value="sum"><h1> Add</h1></option>
            <option value="subtract"><h1> Subtract</h1></option>
            <option value="multiplication"><h1> Multiplication</h1></option>
            <option value="divide"><h1> Divide</h1></option>
          </select>
          <br />
          <button type="submit"  onClick={calculatedSum}> Calculate </button>
          <p>Sum is : {total}</p>
        </div>
      </div>
  )
}