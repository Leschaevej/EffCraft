import "./Calendar.scss";

interface CalendarProps {
    date: string;
    time: string;
}

export default function Calendar({ date, time }: CalendarProps) {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('fr-FR', { month: 'long' });

    return (
        <div className="wrapper">
            <div className="calendar">
                <div className="month">{month}</div>
                <div className="day">{day}</div>
            </div>
            <div className="time">{time}</div>
        </div>
    );
}