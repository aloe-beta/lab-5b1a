import { post } from './global.tsx';
import { h, Fragment } from './dom.ts';

// class Calendar {
//     year;
//     month;
//     monthName;
//     day;
//     days;
//     firstDay;
//     rows;

//     constructor() {
//         const date = new Date();
//         this.year = date.getFullYear();
//         this.month = date.getMonth();
//         this.monthName = date.toLocaleString('default', { month: 'long' });
//         this.day = date.getDate();
//         this.days = Calendar.daysInMonth(this.year, this.month);
//         this.firstDay = new Date(this.year, this.month, 1).getDay();
//         const rowCount = Math.ceil((this.days + this.firstDay)/7);
//         const lastDays = Calendar.daysInMonth(this.year, this.month - 1);
//         const nextDays = Calendar.daysInMonth(this.year, this.month + 1);
        
//         // TODO: Rewrite more efficiently
//         this.rows = [];
//         let time = new Date(this.year, this.month, 1 - this.firstDay).getTime();
//         for (let i = 0; i < rowCount; i++) {
//             const row = [];
//             for (let j = 0; j < 7; j++) {
//                 row.push(new Date(time).getDate());
//                 time += 86400000;
//             }
//             this.rows.push(row);
//         }
//     }

//     static daysInMonth(year: number, month: number) {
//         return new Date(year, month, 0).getDate();
//     }
// }

// function observe(object: any, prop: string) {
//     let value = object[prop];
//     const node = document.createTextNode(value);
//     const descriptor = Object.getOwnPropertyDescriptor(object, prop);
//     const setter = descriptor?.set;
//     const getter = descriptor?.get;

//     if (typeof getter !== typeof setter) {
//         throw "Property not observable.";
//     }

//     const set = setter ? (v: any) => {
//         setter(v);
//         node.textContent = object[prop];
//     } : (v: any) => {
//         value = v;
//         node.textContent = v;
//     };

//     const get = getter || (() => {
//         return value;
//     });

//     Object.defineProperty(object, prop, { set, get });
//     return node;
// }

// function CalendarWidget(props: any) {
//     const calendar = (props?.calendar || new Calendar()) as Calendar;
//     delete props?.calendar;

//     const titleElement = <span>{observe(calendar, 'monthName')} {observe(calendar, 'year')}</span>;
//     const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

//     const range = Array.from({ length: 7 }, (_, i) => i);
//     const dateContainer = <table>
//         <tr>{days.map(day => (<th>{day}</th>))}</tr>
//         {calendar.rows.map(row => <tr>{row.map(day => <td>{day}</td>)}</tr>)}
//     </table>;

//     return (
//         <div class='calendar-widget'>
//             <div>
//                 {titleElement}
//                 <span style='float: right;'>
//                     <button>&lt;</button>
//                     <button>&gt;</button>
//                 </span>
//             </div>
//             {dateContainer}
//         </div>
//     );
// }

class Calendar {
    month;
    monthName;
    startDay = 0;
    weekDays;
    date;
    day;
    year;

    constructor() {
        const date = new Date();
        this.month = date.getMonth();
        this.monthName = date.toLocaleString('default', { month: 'long' });
        this.weekDays = Array.from({ length: 7 }, (_, i) => 
            new Date(1970, 0, 4 + i + this.startDay).toLocaleDateString('default', { weekday: 'short' })
        );
        this.date = date;
        this.day = date.getDate();
        this.year = date.getFullYear();
    }
}

function CalendarWeekView(calendar: Calendar) {
    const weekStart = calendar.day - calendar.date.getDay();
    const {year, month} = calendar;
    const weekDate = new Date(year, month, weekStart);

    const header = <div class='header'>{calendar.weekDays.map((day, i) => 
        <button>
            <span class='day'>{day} </span>
            <span class='date'>{new Date(year, month, weekStart + i).getDate()}</span>
        </button>
    )}</div>;

    const container = (
        <div class='container'>
            <div class='times'>
                {Array.from({ length: 23 }, (_, i) => 
                    <div class='time'>{(i + 1).toString().padStart(2, '0') + ':00'}</div>
                )}
                <div class='time'></div>
            </div>
            {Array.from({ length: 7 }, (_, i) => 
                <div class='day'></div>
            )}
        </div>
    );

    return (<div class='week-view'>
        {header}
        {container}
    </div>);
}

function CalendarView() {
    const calendar = new Calendar();
    const view = CalendarWeekView(calendar);

    return (<div class='calendar-view'>
        {view}
    </div>);
}

function App() {
    return (<>
        {/* <CalendarWidget /> */}
        <CalendarView />
    </>);
};

document.body.append(<>
    <App />
</>);