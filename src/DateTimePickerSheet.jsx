import { X } from 'lucide-react'

export default function DateTimePickerSheet({
  show,
  onClose,
  displayMonth,
  setDisplayMonth,
  pickedDate,
  setPickedDate,
  pickedTime,
  setPickedTime,
  pickedPeriod,
  setPickedPeriod,
  onConfirm,
}) {
  if (!show) return null
  const days = buildCalendarDays(displayMonth)
  const monthLabel = displayMonth.toLocaleString([], { month: "long", year: "numeric" })
  const timeSlots = getTimeSlots(30)
  const today = new Date()
  const isSameDay = (d1, d2) =>
    d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg h-[80vh] bg-slate-900 border-t border-white/10 rounded-t-3xl p-5 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h2 className="m-0 text-xl font-bold text-white">Pick Date & Time</h2>
          <button onClick={onClose} className="bg-slate-700 p-2 rounded-full text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-2.5">
          <button
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
            className="bg-white/10 text-white px-2.5 py-1.5 rounded-lg"
          >
            Prev
          </button>
          <div className="font-bold text-white">{monthLabel}</div>
          <button
            onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
            className="bg-white/10 text-white px-2.5 py-1.5 rounded-lg"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
            <div key={d} className="text-sm text-center text-slate-400">
              {d}
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />
            const dateObj = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
            const selected = isSameDay(dateObj, pickedDate)
            const isToday = isSameDay(dateObj, today)
            return (
              <button
                key={`${displayMonth.getMonth()}-${day}`}
                onClick={() => setPickedDate(dateObj)}
                className={`py-2 rounded-lg ${
                  selected ? "bg-accent text-black" : "bg-white/10 text-white"
                } ${isToday && !selected ? "border border-accent" : ""}`}
              >
                {day}
              </button>
            )
          })}
        </div>

        <div className="mt-2 mb-2.5 font-semibold text-white">Time</div>
        <div className="flex gap-2 mb-2.5">
          <button
            onClick={() => setPickedPeriod("AM")}
            className={`flex-1 p-2 rounded-lg font-semibold ${
              pickedPeriod === "AM" ? "bg-accent text-black" : "bg-white/10 text-white"
            }`}
          >
            AM
          </button>
          <button
            onClick={() => setPickedPeriod("PM")}
            className={`flex-1 p-2 rounded-lg font-semibold ${
              pickedPeriod === "PM" ? "bg-accent text-black" : "bg-white/10 text-white"
            }`}
          >
            PM
          </button>
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2">
          {timeSlots.map((t) => {
            const candidate = to24Time(t.hour, t.minute, pickedPeriod)
            const isSelected = pickedTime === candidate
            return (
              <button
                key={t.label}
                onClick={() => setPickedTime(candidate)}
                className={`py-2.5 rounded-lg font-semibold ${
                  isSelected ? "bg-accent text-black" : "bg-white/10 text-white"
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={onConfirm}
          className="mt-3.5 bg-accent text-black p-3 rounded-full flex items-center justify-center w-full font-bold"
        >
          Confirm Date & Time
        </button>
      </div>
    </div>
  )
}

function getTimeSlots(stepMinutes = 30) {
  const slots = []
  for (let h = 1; h <= 12; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      const label = `${h}:${String(m).padStart(2, "0")}`
      slots.push({ hour: h, minute: m, label })
    }
  }
  return slots
}

function to24Hour(hour12, period) {
  if (period === "AM") return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

function to24Time(hour12, minute, period) {
  const hour24 = to24Hour(hour12, period)
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  return cells
}