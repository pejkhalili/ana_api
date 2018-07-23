
let anp1 =  document.getElementById("add_new_app_frame")
anp1.innerHTML = `<form method="POST">
                    <div class="form-row">
                    <div class="col-md-4 mb-3">
                    <label for="appname">Application Name</label>
                    <input type="text" class="form-control" id="appname" name="appName" placeholder="My App"  required>

                    </div>
                    <div class="col-md-4 mb-3">
                    <label for="packName">Package Name</label>
                    <input type="text" class="form-control" id="packName" name="packName"placeholder="Package Name">

                    </div>
                    </div>

                    <div class="form-group">
                    <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="invalidCheck3" required>
                    <label class="form-check-label" for="invalidCheck3">
                    <a class="muted-text" href="#"><small>Agree to terms and conditions</small></a>
                    </label>
                    </div>
                    </div>
                    <button class="btn btn-primary ml-auto" name = "NAP" value = "nap1" type="submit">Next</button>
                    </form>`;