import { LitElement, html } from "https://unpkg.com/lit?module";
import { classMap } from "https://unpkg.com/lit-html@2.3.1/directives/class-map.js?module";
import { unsafeHTML } from 'https://unpkg.com/lit-html@latest/directives/unsafe-html.js?module';

// Configure the preview in the Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'canvas-homework-dashboard',
  name: 'Canvas Homework Dashboard',
  preview: true,
  description: 'A dashboard card displaying Canvas homework with interactive toggles.',
});

class CanvasHomeworkDashboard extends LitElement {
  static getproperties() {
    return {
      entities: {
        type: "object",
        title: "Entities",
        default: [
          { domain: "sensor", entity_id: "sensor.canvas_students" },
          { domain: "sensor", entity_id: "sensor.canvas_courses" },
          { domain: "sensor", entity_id: "sensor.canvas_assignments" },
        ],
      },
    };
  }

  set hass(hass) {
    this._hass = hass;
    this.config = this._config || {};
    this.students = [];
    this.courses = [];
    this.assignments = [];
    this.courseAssignments = [];
    this.date = new Date();
    this.lookAheadDays = this.config.look_ahead_days || 6;
    
    if(Array.isArray(this.config.entities)) {
      var configStudents = this.config.entities.find(a => a.entity == "sensor.canvas_students")
      var configCourses = this.config.entities.find(a => a.entity == "sensor.canvas_courses")
      var configAssignments = this.config.entities.find(a => a.entity == "sensor.canvas_assignments")

      var eStudents = configStudents.entity in this._hass.states ? this._hass.states[configStudents.entity] : null
      var eCourses = configCourses.entity in this._hass.states ? this._hass.states[configCourses.entity] : null
      var eAssignments = configAssignments.entity in this._hass.states ? this._hass.states[configAssignments.entity] : null

      // Calculate look-ahead cutoff date
      const lookAheadCutoff = new Date(this.date);
      lookAheadCutoff.setDate(lookAheadCutoff.getDate() + this.lookAheadDays);

      eAssignments.attributes.assignment.forEach(assignment => {
        if (assignment.due_at) {
          const dueDate = new Date(Date.parse(assignment.due_at));
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);

          if (assignment.missing ||
              (dueDate >= today && dueDate <= lookAheadCutoff) ||
              (dueDate < today && Math.abs(dueDate - today) <= 2)) {
            this.courseAssignments.push(assignment.course_id)
            this.assignments.push(assignment)
          }
        }
      })

      // Sort assignments by due date
      this.assignments.sort((a, b) => new Date(a.due_at) - new Date(b.due_at))

      eCourses.attributes.course.forEach(course => {
        if (!this.courses.some(c => c.name == course.name)) {
          this.courseAssignments.some(ca => ca == course.id) && (Date.parse(course.term.start_at) <= this.date && Date.parse(course.term.end_at) >= this.date) {
            // Find the earliest assignment due date for this course
            const courseAssignments = this.assignments.filter(a => a.course_id === course.id)
            if (courseAssignments.length > 0) {
              course.earliestDueDate = Math.min(...courseAssignments.map(a => new Date(a.due_at)))
            }
          }
          this.courses.push(course)
        }
      })

      // Sort courses based on configuration
      if (this.config.course_sort_order === 'alphabetical') {
        this.courses.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        this.courses.sort((a, b) => {
          const dateA = a.earliestDueDate || Infinity;
          const dateB = b.earliestDueDate || Infinity;

          if (dateA === dateB) {
            return a.name.localeCompare(b.name);
          }

          return dateA - dateB;
        });
      }

      eStudents.attributes.student.forEach(student => {
        this.students.push(student)
      })
    }
  }

  render(){
    return html `
    ${this._renderStyle()}
    ${html
      `
      <div style="width:100%; box-sizing:border-box">
        ${this._renderStudents()}
      </div>
      `
      }
    `
  }

  _renderStyle() {
    return html
    `
    <style>
    .canvas-homework-dashboard-card {
      width: 100%;
      box-sizing: border-box;
      background: var(--ha-card-background);
      color: var(--ha-card-content-color);
    }
    
    .hw-toggle { display:none; }

    .hw-row { cursor:pointer; display:flex; align-items:center; gap:0.4em;
    font-size:1.35em; }

    .hw-chevron { display:inline-block; transition: transform 0.15s ease;
    opacity:0.5; font-size:0.8em; }

    .hw-toggle:checked ~ .hw-row .hw-chevron { transform: rotate(90deg); }

    .hw-detail { display:none; margin-top:0.35em; padding:0.6em 0.8em;
    background:rgba(255,255,255,0.06); border-left:3px solid #3b82c4;
    border-radius:4px; font-size:1.3em; line-height:1.5; }

    .hw-toggle:checked ~ .hw-detail { display:block; }

    .hw-detail img { max-width:100%; height:auto; border-radius:4px;
    margin-top:0.4em; }

    .hw-detail p { margin:0.3em 0; }

    .student-info {
      font-size:2.0em;
      font-weight:800;
      margin-bottom:0.3em;
    }

    .course-group {
      margin-top:1em;
      border-top:1px solid rgba(59, 130, 196, 0.3);
      padding-top:0.8em;
    }

    .course-name {
      font-size:1.55em;
      font-weight:700;
      color:#3b82c4;
      margin-top:0.5em;
      margin-bottom:0.2em;
    }

    .assignment-item {
      display:flex;
      align-items:center;
      gap:0.5em;
    }

    .assignment-details {
      font-size:1.3em;
      padding:0.7em 1em;
      background:rgba(255,255,255,0.06);
      border-left:3px solid #3b82c4;
      border-radius:4px;
    }

    .due-today { color:#e05555 !important; font-weight:700 !important; }
    .due-tomorrow { color:#e0a555 !important; font-weight:700 !important; }
    .due-later { color:#8a8a8a !important; font-weight:700 !important; }

    .empty-state {
      margin-left:1.4em;
      font-size:1.4em;
      opacity:0.5;
      font-style:italic;
    }

    ha-card {
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .card-content {
      overflow: hidden;
      width: 100%;
    }
    </style>
    `
  }

  _renderStudents() {
    return html
      `
      ${this.students.map(student =>
        html
        `
          <div class="student-info">${student.name} (${student.id})</div>
          
          ${this.courses.some(c => c.enrollments.find(e => e.user_id == student.id)) ? html
            `
            <div class="course-group">
              ${this.courses.filter(c => c.enrollments.find(e => e.user_id == student.id)).map(course =>
                html
                `
                  <div class="course-name">${course.name}</div>
                  ${this.assignments.filter(a => a.course_id === course.id).map(assignment =>
                    html
                    `
                      <div class="assignment-item">
                        <input type="checkbox" class="hw-toggle" id="hw-${student.id}-${assignment.id}">
                        <label for="hw-${student.id}-${assignment.id}" class="hw-row">
                          <span class="hw-chevron">▸</span>
                          <span>${this._getDueDateClass(assignment.due_at)}</span>
                          <span>${assignment.name}</span>
                        </label>
                      </div>
                    `
                  ))}
                `
              )}
            </div>
            `
          : ""}
        `
      )}
    `
  }

  _getDueDateClass(dueAt) {
    const dueDate = new Date(Date.parse(dueAt));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(dueDate - today);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '#e05555';
    if (diffDays === 1) return '#e0a555';
    return '#8a8a8a';
  }
}

export default CanvasHomeworkDashboard;