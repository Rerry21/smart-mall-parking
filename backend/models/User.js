// backend/models/User.js
const bcrypt = require('bcryptjs');

class User {
  constructor(db) {
    this.collection = db.collection('users');
  }

  // Create new user (with hashed password)
  async create(userData) {
    const { password, ...rest } = userData;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      ...rest,
      password: hashedPassword,
      createdAt: new Date()
    };

    const result = await this.collection.insertOne(newUser);
    return { ...newUser, _id: result.insertedId, password: undefined }; // don't return password
  }

  // Find user by phone
  async findByPhone(phone) {
    return await this.collection.findOne({ phone });
  }

  // Compare password
  async comparePassword(storedPassword, candidatePassword) {
    return await bcrypt.compare(candidatePassword, storedPassword);
  }
}

module.exports = User;