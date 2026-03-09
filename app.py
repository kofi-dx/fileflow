import os
import datetime
from flask import Flask, render_template, request, redirect, url_for, send_file, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import mimetypes

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = 'your-secret-key-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['ALLOWED_EXTENSIONS'] = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize database
db = SQLAlchemy(app)

# Database Model
class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    original_filename = db.Column(db.String(200), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(50))
    upload_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    download_count = db.Column(db.Integer, default=0)
    
    def __repr__(self):
        return f'<File {self.filename}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'upload_date': self.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
            'download_count': self.download_count,
            'size_formatted': self.format_size()
        }
    
    def format_size(self):
        for unit in ['B', 'KB', 'MB', 'GB']:
            if self.file_size < 1024.0:
                return f"{self.file_size:.1f} {unit}"
            self.file_size /= 1024.0
        return f"{self.file_size:.1f} TB"

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/files')
def get_files():
    files = File.query.order_by(File.upload_date.desc()).all()
    return jsonify([file.to_dict() for file in files])

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Secure the filename and save
        original_filename = file.filename
        filename = secure_filename(original_filename)
        
        # Handle duplicate filenames
        base, extension = os.path.splitext(filename)
        counter = 1
        while os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], filename)):
            filename = f"{base}_{counter}{extension}"
            counter += 1
        
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Detect file type
        file_type = mimetypes.guess_type(original_filename)[0] or 'application/octet-stream'
        
        # Create database entry
        new_file = File(
            filename=filename,
            original_filename=original_filename,
            file_size=file_size,
            file_type=file_type
        )
        
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'file': new_file.to_dict()
        }), 200
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/download/<int:file_id>')
def download_file(file_id):
    file_record = File.query.get_or_404(file_id)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_record.filename)
    
    if os.path.exists(file_path):
        # Increment download count
        file_record.download_count += 1
        db.session.commit()
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=file_record.original_filename
        )
    
    return jsonify({'error': 'File not found'}), 404

@app.route('/delete/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    file_record = File.query.get_or_404(file_id)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_record.filename)
    
    # Delete from filesystem
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from database
    db.session.delete(file_record)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'File deleted successfully'})

@app.route('/search')
def search_files():
    query = request.args.get('q', '').lower()
    file_type = request.args.get('type', '')
    
    files_query = File.query
    
    if query:
        files_query = files_query.filter(
            db.or_(
                File.original_filename.ilike(f'%{query}%'),
                File.file_type.ilike(f'%{query}%')
            )
        )
    
    if file_type:
        files_query = files_query.filter(File.file_type.ilike(f'%{file_type}%'))
    
    files = files_query.order_by(File.upload_date.desc()).all()
    return jsonify([file.to_dict() for file in files])

@app.route('/stats')
def get_stats():
    total_files = File.query.count()
    total_size = db.session.query(db.func.sum(File.file_size)).scalar() or 0
    most_downloaded = File.query.order_by(File.download_count.desc()).first()
    
    # Format total size
    size_formatted = File.format_size(File(file_size=total_size))
    
    return jsonify({
        'total_files': total_files,
        'total_size': size_formatted,
        'most_downloaded': most_downloaded.original_filename if most_downloaded else 'None',
        'most_downloaded_count': most_downloaded.download_count if most_downloaded else 0
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True) 